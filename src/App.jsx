import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Link, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { queryClientInstance } from '@/lib/query-client';
import { pagesConfig } from './pages.config';
import PageNotFound from './lib/PageNotFound';
import { createPageUrl } from '@/utils';
import RouteGuard from '@/components/auth/RouteGuard';

const { Pages, Layout } = pagesConfig;

const LayoutWrapper = ({ children, currentPageName }) =>
  Layout ? <Layout currentPageName={currentPageName}>{children}</Layout> : <>{children}</>;

function FrontendPreview() {
  const pages = Object.keys(Pages);

  return (
    <main className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Preview Frontend (sem backend)</h1>
          <p className="text-sm text-muted-foreground">
            Navegue livremente pelas páginas abaixo. O projeto está em modo frontend-only com dados mockados locais.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comandos de desenvolvimento/build</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <Badge variant="secondary">npm run dev</Badge> Inicia preview local
            </p>
            <p>
              <Badge variant="secondary">npm run build</Badge> Build de produção
            </p>
            <p>
              <Badge variant="secondary">npm run build:dev</Badge> Build em modo development
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Páginas disponíveis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pages.map((page) => (
                <Link
                  key={page}
                  to={createPageUrl(page)}
                  className="rounded-md border border-border px-3 py-2 hover:bg-muted transition-colors"
                >
                  {page}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <Routes>
          <Route path="/" element={<FrontendPreview />} />
          {Object.entries(Pages).map(([path, Page]) => (
            <Route
              key={path}
              path={`/${path}`}
              element={
                <LayoutWrapper currentPageName={path}>
                  <RouteGuard pageName={path}>
                    <Page />
                  </RouteGuard>
                </LayoutWrapper>
              }
            />
          ))}
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
