import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Récupérer tous les utilisateurs
  app.get("/api/users", async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération des utilisateurs" });
    }
  });

  // Récupérer un utilisateur par ID
  app.get("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID invalide" });
      }
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération de l'utilisateur" });
    }
  });

  // Créer un nouvel utilisateur
  app.post("/api/users", async (req, res) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Données invalides", errors: result.error.errors });
      }

      // Vérifier si le prénom existe déjà
      const existingUser = await storage.getUserByName(result.data.name);
      if (existingUser) {
        return res.status(409).json({ message: "Ce prénom existe déjà" });
      }

      const user = await storage.createUser(result.data);
      res.status(201).json(user);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la création de l'utilisateur" });
    }
  });

  return httpServer;
}
