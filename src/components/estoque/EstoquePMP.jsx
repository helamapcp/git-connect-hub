import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FlaskConical } from 'lucide-react';

export default function EstoquePMP() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5" />
          <h2 className="font-semibold">PMP</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Área de produção de composto e disponibilização para a Fábrica.
        </p>
      </CardContent>
    </Card>
  );
}
