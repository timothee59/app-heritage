import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Users, Heart, Package, Euro } from "lucide-react";

interface RepartitionStat {
  userId: number;
  userName: string;
  userRole: string;
  itemCount: number;
  itemsWithValue: number;
  totalValue: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

export default function RepartitionPage() {
  const [, setLocation] = useLocation();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const storedUserId = localStorage.getItem("user_id");
    if (!storedUserId) {
      setLocation("/");
      return;
    }
    setCurrentUserId(storedUserId);
  }, [setLocation]);

  const { data: stats, isLoading } = useQuery<RepartitionStat[]>({
    queryKey: ["/api/stats/repartition"],
    queryFn: async () => {
      const response = await fetch("/api/stats/repartition");
      if (!response.ok) return [];
      return await response.json();
    },
    enabled: !!currentUserId,
  });

  const totalItems = stats?.reduce((sum, s) => sum + s.itemCount, 0) || 0;
  const totalValue = stats?.reduce((sum, s) => sum + s.totalValue, 0) || 0;
  const maxValue = stats && stats.length > 0 ? Math.max(...stats.map(s => s.totalValue)) : 0;
  const minValue = stats && stats.length > 0 ? Math.min(...stats.map(s => s.totalValue)) : 0;
  const ecartMax = maxValue - minValue;

  if (!currentUserId) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/gallery")}
            className="w-12 h-12"
            data-testid="button-back"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-semibold">Répartition</h1>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Euro className="w-5 h-5" />
              Vue d'ensemble
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-32" />
              </div>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total des choix "Je le veux !"</span>
                  <span className="font-medium">{totalItems} objets</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valeur totale estimée</span>
                  <span className="font-medium">{formatCurrency(totalValue)}</span>
                </div>
                {stats && stats.length > 1 && ecartMax > 0 && (
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-muted-foreground">Écart max entre membres</span>
                    <span className="font-medium text-amber-600 dark:text-amber-400">{formatCurrency(ecartMax)}</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500" />
            Par personne
          </h2>
          
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="py-4">
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : stats && stats.length > 0 ? (
            <div className="space-y-3">
              {stats.map((stat, index) => (
                <Card 
                  key={stat.userId} 
                  className={index === 0 && stats.length > 1 && stat.totalValue > 0 ? "ring-2 ring-green-500" : ""}
                  data-testid={`stat-card-${stat.userId}`}
                >
                  <CardContent className="py-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">{stat.userName}</span>
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {stat.userRole === "parent" ? "Parent" : "Enfant"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                          <Package className="w-4 h-4" />
                          <span>{stat.itemCount} objet{stat.itemCount > 1 ? "s" : ""}</span>
                          {stat.itemsWithValue < stat.itemCount && (
                            <span className="text-xs">({stat.itemsWithValue} valorisé{stat.itemsWithValue > 1 ? "s" : ""})</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(stat.totalValue)}
                        </span>
                      </div>
                    </div>
                    {stat.totalValue > 0 && totalValue > 0 && (
                      <div className="mt-3">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${(stat.totalValue / totalValue) * 100}%` }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 text-right">
                          {Math.round((stat.totalValue / totalValue) * 100)}% du total
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Heart className="w-8 h-8 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-medium mb-2">Aucun choix enregistré</h2>
                <p className="text-muted-foreground mb-4">
                  Les membres de la famille n'ont pas encore exprimé de préférences.
                </p>
                <Button variant="outline" onClick={() => setLocation("/gallery")}>
                  Voir la galerie
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
