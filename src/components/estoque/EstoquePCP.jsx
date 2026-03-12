import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Boxes } from 'lucide-react';

export default function EstoquePCP() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-2">
        <div className="flex items-center gap-2">
          <Boxes className="w-5 h-5" />
          <h2 className="font-semibold">PCP</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Controle de estoque intermediário para planejamento e transferência para PMP.
        </p>
      </CardContent>
    </Card>
  );
}
