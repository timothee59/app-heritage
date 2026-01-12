import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Users, Heart, Package, Euro, HelpCircle } from "lucide-react";

interface RepartitionStat {
  userId: number;
  userName: string;
  userRole: string;
  loveCount: number;
  loveItemsWithValue: number;
  loveValue: number;
  maybeCount: number;
  maybeItemsWithValue: number;
  maybeValue: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
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

  const totalLoveItems = stats?.reduce((sum, s) => sum + s.loveCount, 0) || 0;
  const totalLoveValue = stats?.reduce((sum, s) => sum + s.loveValue, 0) || 0;
  const totalMaybeItems = stats?.reduce((sum, s) => sum + s.maybeCount, 0) || 0;
  const totalMaybeValue = stats?.reduce((sum, s) => sum + s.maybeValue, 0) || 0;
  const maxLoveValue = stats && stats.length > 0 ? Math.max(...stats.map(s => s.loveValue)) : 0;
  const minLoveValue = stats && stats.length > 0 ? Math.min(...stats.map(s => s.loveValue)) : 0;
  const ecartMax = maxLoveValue - minLoveValue;

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
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-32" />
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Heart className="w-4 h-4 text-red-500" />
                      "Je le veux !"
                    </span>
                    <span className="font-medium">{totalLoveItems} objets = {formatCurrency(totalLoveValue)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-orange-500" />
                      "Si personne d'autre"
                    </span>
                    <span className="font-medium">{totalMaybeItems} objets = {formatCurrency(totalMaybeValue)}</span>
                  </div>
                </div>
                {stats && stats.length > 1 && ecartMax > 0 && (
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-muted-foreground">Écart max (Je le veux !)</span>
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
                  className={index === 0 && stats.length > 1 && stat.loveValue > 0 ? "ring-2 ring-green-500" : ""}
                  data-testid={`stat-card-${stat.userId}`}
                >
                  <CardContent className="py-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-lg">{stat.userName}</span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {stat.userRole === "parent" ? "Parent" : "Enfant"}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                          <span>{stat.loveCount} objet{stat.loveCount > 1 ? "s" : ""}</span>
                          {stat.loveItemsWithValue < stat.loveCount && stat.loveCount > 0 && (
                            <span className="text-xs">({stat.loveItemsWithValue} valorisé{stat.loveItemsWithValue > 1 ? "s" : ""})</span>
                          )}
                        </div>
                        <span className="text-lg font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(stat.loveValue)}
                        </span>
                      </div>
                      
                      {stat.maybeCount > 0 && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <HelpCircle className="w-4 h-4 text-orange-500" />
                            <span>{stat.maybeCount} en attente</span>
                            {stat.maybeItemsWithValue < stat.maybeCount && (
                              <span className="text-xs">({stat.maybeItemsWithValue} valorisé{stat.maybeItemsWithValue > 1 ? "s" : ""})</span>
                            )}
                          </div>
                          <span className="font-medium text-orange-600 dark:text-orange-400">
                            + {formatCurrency(stat.maybeValue)}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {stat.loveValue > 0 && totalLoveValue > 0 && (
                      <div className="mt-3">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${(stat.loveValue / totalLoveValue) * 100}%` }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 text-right">
                          {Math.round((stat.loveValue / totalLoveValue) * 100)}% des "Je le veux !"
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
