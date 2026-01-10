import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import IdentificationPage from "@/pages/identification";
import GalleryPage from "@/pages/gallery";
import AddUserPage from "@/pages/add-user";

function Router() {
  return (
    <Switch>
      <Route path="/" component={IdentificationPage} />
      <Route path="/gallery" component={GalleryPage} />
      <Route path="/add-user" component={AddUserPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
