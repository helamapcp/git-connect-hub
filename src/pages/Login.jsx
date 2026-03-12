import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, LogIn } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;

    base44.auth
      .me()
      .then(() => {
        if (mounted) {
          navigate(createPageUrl('MachineSelection'), { replace: true });
        }
      })
      .catch(() => {
        if (mounted) {
          setCheckingSession(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleLogin = () => {
    base44.auth.redirectToLogin(window.location.origin + createPageUrl('MachineSelection'));
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">Entrar no sistema</CardTitle>
          <CardDescription>
            Use sua conta autorizada para acessar o painel de produção.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {checkingSession ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verificando sessão...
            </div>
          ) : (
            <Button onClick={handleLogin} className="w-full">
              <LogIn className="w-4 h-4 mr-2" />
              Entrar
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
