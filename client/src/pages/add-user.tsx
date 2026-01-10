import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, UserPlus, Users, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User as UserType } from "@shared/schema";

const addUserSchema = z.object({
  name: z.string().min(2, "Le prenom doit contenir au moins 2 caracteres"),
  role: z.enum(["parent", "enfant"], { required_error: "Veuillez choisir un role" }),
});

type AddUserForm = z.infer<typeof addUserSchema>;

export default function AddUserPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AddUserForm>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      name: "",
      role: undefined,
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: AddUserForm) => {
      const response = await apiRequest("POST", "/api/users", data);
      return await response.json() as UserType;
    },
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      localStorage.setItem("user_id", user.id.toString());
      toast({
        title: "Bienvenue !",
        description: `Votre prenom ${user.name} a ete ajoute.`,
      });
      setLocation("/gallery");
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Ce prenom existe deja ou une erreur est survenue.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AddUserForm) => {
    createUserMutation.mutate(data);
  };

  const handleBack = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <UserPlus className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl">Ajouter mon prenom</CardTitle>
            <CardDescription className="text-base">
              Rejoignez la famille pour participer au partage
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Votre prenom</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Entrez votre prenom"
                        className="h-12 text-base"
                        data-testid="input-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Vous etes</FormLabel>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <Button
                        type="button"
                        variant={field.value === "parent" ? "default" : "outline"}
                        className="h-20 flex-col gap-2"
                        onClick={() => field.onChange("parent")}
                        data-testid="button-role-parent"
                      >
                        <Users className="w-6 h-6" />
                        <span className="text-base">Parent</span>
                      </Button>
                      <Button
                        type="button"
                        variant={field.value === "enfant" ? "default" : "outline"}
                        className="h-20 flex-col gap-2"
                        onClick={() => field.onChange("enfant")}
                        data-testid="button-role-enfant"
                      >
                        <User className="w-6 h-6" />
                        <span className="text-base">Enfant</span>
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-12 text-base"
                disabled={createUserMutation.isPending}
                data-testid="button-submit"
              >
                {createUserMutation.isPending ? "Ajout en cours..." : "Rejoindre la famille"}
              </Button>
            </form>
          </Form>

          <div className="pt-6 border-t mt-6">
            <Button
              variant="ghost"
              className="w-full h-12 text-base gap-2"
              onClick={handleBack}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
              Retour a la liste
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
