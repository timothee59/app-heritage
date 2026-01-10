import { pgTable, text, varchar, serial, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Utilisateurs (identification simple)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  role: varchar("role", { length: 10 }).notNull(), // 'parent' ou 'enfant'
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  name: true,
  role: true,
}).extend({
  role: z.enum(["parent", "enfant"]),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Fiches (items du catalogue)
export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull(), // Numéro auto-incrémenté (#1, #2, #3...)
  title: varchar("title", { length: 100 }), // Titre optionnel
  description: text("description"), // Description optionnelle
  createdBy: integer("created_by").notNull(), // ID de l'utilisateur qui a créé
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertItemSchema = createInsertSchema(items).pick({
  createdBy: true,
});

export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof items.$inferSelect;

// Photos des fiches
export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull(), // Référence vers la fiche
  data: text("data").notNull(), // Image en base64 (data:image/jpeg;base64,...)
  position: integer("position").notNull().default(0), // Ordre de la photo
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPhotoSchema = createInsertSchema(photos).pick({
  itemId: true,
  data: true,
  position: true,
});

export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type Photo = typeof photos.$inferSelect;

// Type combiné pour une fiche avec ses photos
export type ItemWithPhotos = Item & { photos: Photo[] };

// Type pour les fiches en conflit (avec liste des personnes qui les veulent)
export type ItemWithPhotosAndLovers = ItemWithPhotos & { lovers: string[]; loveCount: number };

// Commentaires sur les fiches
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull(),
  userId: integer("user_id").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCommentSchema = createInsertSchema(comments).pick({
  itemId: true,
  userId: true,
  text: true,
});

export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

// Type combiné pour un commentaire avec son auteur
export type CommentWithUser = Comment & { user: { id: number; name: string } };

// Préférences des utilisateurs sur les fiches
export const preferences = pgTable("preferences", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull(),
  userId: integer("user_id").notNull(),
  level: varchar("level", { length: 10 }).notNull(), // 'love', 'maybe', 'no'
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("preferences_item_user_unique").on(table.itemId, table.userId),
]);

export const insertPreferenceSchema = createInsertSchema(preferences).pick({
  itemId: true,
  userId: true,
  level: true,
}).extend({
  level: z.enum(["love", "maybe", "no"]),
});

export type InsertPreference = z.infer<typeof insertPreferenceSchema>;
export type Preference = typeof preferences.$inferSelect;

// Type combiné pour une préférence avec l'utilisateur
export type PreferenceWithUser = Preference & { user: { id: number; name: string; role: string } };
