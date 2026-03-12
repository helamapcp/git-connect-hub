import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Plus, Edit, Trash2, Power, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { appendSystemLog } from '@/lib/systemLog';
import { useUsersStore } from '@/lib/userStore';
import { ROLE_LABELS, ROLE_IDS, canPerformAction, getRoleLabel } from '@/lib/rbac';

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

const EMPTY_FORM = {
  full_name: '',
  email: '',
  role: ROLE_IDS.MACHINE_OPERATOR,
};

export default function GestaoUsuarios() {
  const { users, currentUser, addUser, updateUser, setUserActive, deleteUser, switchCurrentUser } = useUsersStore();
  const canManageUsers = canPerformAction(currentUser?.role, 'users.manage') || currentUser?.role === ROLE_IDS.ADMIN;

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userToDelete, setUserToDelete] = useState(null);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const text = `${user.full_name} ${user.email}`.toLowerCase();
      const searchOk = !search.trim() || text.includes(search.trim().toLowerCase());
      const roleOk = roleFilter === 'all' || user.role === roleFilter;
      const statusOk = statusFilter === 'all' || (statusFilter === 'active' ? user.active !== false : user.active === false);
      return searchOk && roleOk && statusOk;
    });
  }, [users, search, roleFilter, statusFilter]);

  const summaryByRole = useMemo(() => {
    return ROLE_OPTIONS.map((role) => ({
      ...role,
      total: users.filter((user) => user.role === role.value && user.active !== false).length,
    }));
  }, [users]);

  const openCreate = () => {
    if (!canManageUsers) return toast.error('Your role cannot manage users.');
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (user) => {
    if (!canManageUsers) return toast.error('Your role cannot manage users.');
    setEditingUser(user);
    setForm({
      full_name: user.full_name || '',
      email: user.email || '',
      role: user.role || ROLE_IDS.MACHINE_OPERATOR,
    });
    setShowModal(true);
  };

  const onSave = () => {
    if (!canManageUsers) return toast.error('Your role cannot manage users.');

    try {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
      };

      if (!payload.full_name || !payload.email) {
        toast.error('Name and email are required.');
        return;
      }

      if (editingUser) {
        const before = { ...editingUser };
        updateUser(editingUser.id, payload);
        appendSystemLog({
          action: 'Edit user',
          action_type: 'edit',
          location: 'SETTINGS',
          parameters: {
            user_id: editingUser.id,
            before,
            after: payload,
          },
        });
        toast.success('User updated.');
      } else {
        const created = addUser(payload);
        appendSystemLog({
          action: 'Create user',
          action_type: 'create',
          location: 'SETTINGS',
          parameters: {
            user_id: created.id,
            email: created.email,
            role: created.role,
          },
        });
        toast.success('User created.');
      }

      setShowModal(false);
      setEditingUser(null);
      setForm(EMPTY_FORM);
    } catch (error) {
      toast.error(error.message || 'Unable to save user.');
    }
  };

  const onToggleUser = (user) => {
    if (!canManageUsers) return toast.error('Your role cannot manage users.');
    if (user.id === currentUser?.id && user.active !== false) {
      toast.error('You cannot deactivate your own active session user.');
      return;
    }

    const nextActive = user.active === false;
    setUserActive(user.id, nextActive);
    appendSystemLog({
      action: nextActive ? 'Activate user' : 'Deactivate user',
      action_type: 'update',
      location: 'SETTINGS',
      parameters: {
        user_id: user.id,
        email: user.email,
        active: nextActive,
      },
    });
    toast.success(nextActive ? 'User activated.' : 'User deactivated.');
  };

  const onDeleteUser = () => {
    if (!userToDelete) return;
    if (!canManageUsers) return toast.error('Your role cannot manage users.');
    if (userToDelete.id === currentUser?.id) {
      toast.error('You cannot delete your current active user.');
      setUserToDelete(null);
      return;
    }

    deleteUser(userToDelete.id);
    appendSystemLog({
      action: 'Delete user',
      action_type: 'delete',
      location: 'SETTINGS',
      parameters: {
        user_id: userToDelete.id,
        email: userToDelete.email,
      },
    });
    toast.success('User removed.');
    setUserToDelete(null);
  };

  const onSwitchUser = (userId) => {
    try {
      const selected = switchCurrentUser(userId);
      appendSystemLog({
        action: 'Switch active user',
        action_type: 'auth',
        location: 'SISTEMA',
        parameters: {
          user_id: selected.id,
          role: selected.role,
        },
      });
      toast.success(`Now acting as ${selected.full_name}.`);
    } catch (error) {
      toast.error(error.message || 'Could not switch user.');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Users className="w-5 h-5 text-primary" />
            Users & Role Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email"
              className="md:col-span-2"
            />
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={openCreate} disabled={!canManageUsers}>
              <Plus className="w-4 h-4 mr-2" />
              New User
            </Button>
          </div>

          {!canManageUsers && (
            <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Your current role has read-only access to users.
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {summaryByRole.map((item) => (
              <div key={item.value} className="rounded-md border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-xl font-semibold text-foreground">{item.total}</p>
              </div>
            ))}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Session</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No users found with current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => {
                  const isCurrent = user.id === currentUser?.id;

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <p className="font-medium">{user.full_name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getRoleLabel(user.role)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.active !== false ? 'secondary' : 'outline'}>
                          {user.active !== false ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isCurrent ? (
                          <Badge>Current</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onSwitchUser(user.id)}
                            disabled={user.active === false}
                          >
                            <UserCheck className="w-4 h-4 mr-1" />
                            Act as
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(user)} disabled={!canManageUsers}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onToggleUser(user)}
                          disabled={!canManageUsers}
                        >
                          <Power className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setUserToDelete(user)}
                          disabled={!canManageUsers || user.id === currentUser?.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'New User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={form.full_name}
                onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="user@company.com"
              />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(value) => setForm((prev) => ({ ...prev, role: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={onSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <strong>{userToDelete?.full_name}</strong> from the frontend user list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDeleteUser}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
