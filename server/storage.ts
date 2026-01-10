import { type User, type InsertUser, type Item, type Photo, type ItemWithPhotos, type ItemWithPhotosAndDeleteInfo, type ItemWithPhotosAndLovers, type ItemWithUserPreference, type Comment, type CommentWithUser, type Preference, type PreferenceWithUser, users, items, photos, comments, preferences } from "@shared/schema";
import { db } from "./db";
import { eq, asc, desc, max, and, sql, inArray } from "drizzle-orm";

// Interface de stockage pour les opérations CRUD
export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByName(name: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  
  // Items
  getItem(id: number): Promise<ItemWithPhotosAndDeleteInfo | undefined>;
  getAllItems(includeDeleted?: boolean): Promise<ItemWithPhotosAndDeleteInfo[]>;
  createItem(createdBy: number, photoData: string): Promise<ItemWithPhotos>;
  updateItem(id: number, data: { title?: string | null; description?: string | null }): Promise<ItemWithPhotos | undefined>;
  getNextItemNumber(): Promise<number>;
  softDeleteItem(id: number, deletedBy: number): Promise<ItemWithPhotos | undefined>;
  restoreItem(id: number): Promise<ItemWithPhotos | undefined>;
  
  // Photos
  addPhoto(itemId: number, data: string, position: number): Promise<Photo>;
  deletePhoto(photoId: number): Promise<boolean>;
  getPhotosByItemId(itemId: number): Promise<Photo[]>;
  getNextPhotoPosition(itemId: number): Promise<number>;
  reorderPhotos(itemId: number, photoIds: number[]): Promise<void>;
  
  // Comments
  getCommentsByItemId(itemId: number): Promise<CommentWithUser[]>;
  createComment(itemId: number, userId: number, text: string): Promise<CommentWithUser>;
  deleteComment(commentId: number, userId: number): Promise<boolean>;
  
  // Preferences
  getPreferenceByItemAndUser(itemId: number, userId: number): Promise<Preference | undefined>;
  getPreferencesByItemId(itemId: number): Promise<PreferenceWithUser[]>;
  upsertPreference(itemId: number, userId: number, level: string): Promise<Preference>;
  
  // Filtered queries
  getItemsByUserPreference(userId: number, level: string): Promise<ItemWithPhotos[]>;
  getItemsWithConflicts(): Promise<ItemWithPhotosAndLovers[]>;
  getItemsWithoutPreference(userId: number): Promise<ItemWithPhotos[]>;
  getItemsByUserAllPreferences(userId: number): Promise<ItemWithUserPreference[]>;
}

// DatabaseStorage - Utilise PostgreSQL via Drizzle ORM
export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByName(name: string): Promise<User | undefined> {
    const allUsers = await db.select().from(users);
    return allUsers.find(u => u.name.toLowerCase() === name.toLowerCase());
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(asc(users.name));
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Items
  async getNextItemNumber(): Promise<number> {
    const result = await db.select({ maxNum: max(items.number) }).from(items);
    return (result[0]?.maxNum ?? 0) + 1;
  }

  async getItem(id: number): Promise<ItemWithPhotosAndDeleteInfo | undefined> {
    const [item] = await db.select().from(items).where(eq(items.id, id));
    if (!item) return undefined;
    
    const itemPhotos = await db.select().from(photos)
      .where(eq(photos.itemId, id))
      .orderBy(asc(photos.position));
    
    let deletedByName: string | undefined;
    if (item.deletedBy) {
      const [deleter] = await db.select().from(users).where(eq(users.id, item.deletedBy));
      if (deleter) deletedByName = deleter.name;
    }
    
    return { ...item, photos: itemPhotos, deletedByName };
  }

  async getAllItems(includeDeleted: boolean = true): Promise<ItemWithPhotosAndDeleteInfo[]> {
    // Order by: active items first (by number), then deleted items (by number)
    const allItems = await db.execute(sql`
      SELECT i.*, u.name as deleted_by_name
      FROM items i
      LEFT JOIN users u ON i.deleted_by = u.id
      ORDER BY 
        CASE WHEN i.deleted_at IS NULL THEN 0 ELSE 1 END,
        i.number
    `);
    
    const result: ItemWithPhotosAndDeleteInfo[] = [];
    for (const row of allItems.rows) {
      // Skip deleted items if not included
      if (!includeDeleted && row.deleted_at) continue;
      
      const itemPhotos = await db.select().from(photos)
        .where(eq(photos.itemId, row.id as number))
        .orderBy(asc(photos.position));
      
      result.push({
        id: row.id as number,
        number: row.number as number,
        title: row.title as string | null,
        description: row.description as string | null,
        createdBy: row.created_by as number,
        createdAt: row.created_at ? new Date(row.created_at as string) : null,
        deletedAt: row.deleted_at ? new Date(row.deleted_at as string) : null,
        deletedBy: row.deleted_by as number | null,
        photos: itemPhotos,
        deletedByName: row.deleted_by_name as string | undefined
      });
    }
    
    return result;
  }

  async softDeleteItem(id: number, deletedBy: number): Promise<ItemWithPhotos | undefined> {
    const [updated] = await db.update(items)
      .set({ deletedAt: new Date(), deletedBy })
      .where(eq(items.id, id))
      .returning();
    
    if (!updated) return undefined;
    
    const itemPhotos = await db.select().from(photos)
      .where(eq(photos.itemId, id))
      .orderBy(asc(photos.position));
    
    return { ...updated, photos: itemPhotos };
  }

  async restoreItem(id: number): Promise<ItemWithPhotos | undefined> {
    const [updated] = await db.update(items)
      .set({ deletedAt: null, deletedBy: null })
      .where(eq(items.id, id))
      .returning();
    
    if (!updated) return undefined;
    
    const itemPhotos = await db.select().from(photos)
      .where(eq(photos.itemId, id))
      .orderBy(asc(photos.position));
    
    return { ...updated, photos: itemPhotos };
  }

  async createItem(createdBy: number, photoData: string): Promise<ItemWithPhotos> {
    const number = await this.getNextItemNumber();
    
    const [item] = await db.insert(items).values({
      number,
      createdBy,
      title: null,
      description: null,
    }).returning();
    
    const photo = await this.addPhoto(item.id, photoData, 0);
    
    return { ...item, photos: [photo] };
  }

  async updateItem(id: number, data: { title?: string | null; description?: string | null }): Promise<ItemWithPhotos | undefined> {
    const [updatedItem] = await db.update(items)
      .set(data)
      .where(eq(items.id, id))
      .returning();
    
    if (!updatedItem) return undefined;
    
    const itemPhotos = await db.select().from(photos)
      .where(eq(photos.itemId, id))
      .orderBy(asc(photos.position));
    
    return { ...updatedItem, photos: itemPhotos };
  }

  // Photos
  async addPhoto(itemId: number, data: string, position: number): Promise<Photo> {
    const [photo] = await db.insert(photos).values({
      itemId,
      data,
      position,
    }).returning();
    return photo;
  }

  async deletePhoto(photoId: number): Promise<boolean> {
    const result = await db.delete(photos).where(eq(photos.id, photoId)).returning();
    return result.length > 0;
  }

  async getPhotosByItemId(itemId: number): Promise<Photo[]> {
    return db.select().from(photos)
      .where(eq(photos.itemId, itemId))
      .orderBy(asc(photos.position));
  }

  async getNextPhotoPosition(itemId: number): Promise<number> {
    const result = await db.select({ maxPos: max(photos.position) })
      .from(photos)
      .where(eq(photos.itemId, itemId));
    return (result[0]?.maxPos ?? -1) + 1;
  }

  async reorderPhotos(itemId: number, photoIds: number[]): Promise<void> {
    for (let i = 0; i < photoIds.length; i++) {
      await db.update(photos)
        .set({ position: i })
        .where(eq(photos.id, photoIds[i]));
    }
  }

  // Comments
  async getCommentsByItemId(itemId: number): Promise<CommentWithUser[]> {
    const itemComments = await db.select().from(comments)
      .where(eq(comments.itemId, itemId))
      .orderBy(asc(comments.createdAt));
    
    const result: CommentWithUser[] = [];
    for (const comment of itemComments) {
      const [user] = await db.select().from(users).where(eq(users.id, comment.userId));
      if (user) {
        result.push({
          ...comment,
          user: { id: user.id, name: user.name }
        });
      }
    }
    
    return result;
  }

  async createComment(itemId: number, userId: number, text: string): Promise<CommentWithUser> {
    const [comment] = await db.insert(comments).values({
      itemId,
      userId,
      text,
    }).returning();
    
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    return {
      ...comment,
      user: { id: user.id, name: user.name }
    };
  }

  async deleteComment(commentId: number, userId: number): Promise<boolean> {
    const [comment] = await db.select().from(comments).where(eq(comments.id, commentId));
    if (!comment || comment.userId !== userId) {
      return false;
    }
    
    const result = await db.delete(comments).where(eq(comments.id, commentId)).returning();
    return result.length > 0;
  }

  // Preferences
  async getPreferenceByItemAndUser(itemId: number, userId: number): Promise<Preference | undefined> {
    const [preference] = await db.select().from(preferences)
      .where(and(eq(preferences.itemId, itemId), eq(preferences.userId, userId)));
    return preference || undefined;
  }

  async getPreferencesByItemId(itemId: number): Promise<PreferenceWithUser[]> {
    const itemPreferences = await db.select().from(preferences)
      .where(eq(preferences.itemId, itemId));
    
    const result: PreferenceWithUser[] = [];
    for (const pref of itemPreferences) {
      const [user] = await db.select().from(users).where(eq(users.id, pref.userId));
      if (user) {
        result.push({
          ...pref,
          user: { id: user.id, name: user.name, role: user.role }
        });
      }
    }
    
    return result;
  }

  async upsertPreference(itemId: number, userId: number, level: string): Promise<Preference> {
    const existing = await this.getPreferenceByItemAndUser(itemId, userId);
    
    if (existing) {
      const [updated] = await db.update(preferences)
        .set({ level, updatedAt: new Date() })
        .where(eq(preferences.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(preferences).values({
        itemId,
        userId,
        level,
      }).returning();
      return created;
    }
  }

  // Filtered queries
  async getItemsByUserPreference(userId: number, level: string): Promise<ItemWithPhotos[]> {
    // Get item IDs where user has this preference level
    const userPrefs = await db.select({ itemId: preferences.itemId })
      .from(preferences)
      .where(and(eq(preferences.userId, userId), eq(preferences.level, level)));
    
    if (userPrefs.length === 0) return [];
    
    const itemIds = userPrefs.map(p => p.itemId);
    const matchingItems = await db.select().from(items)
      .where(inArray(items.id, itemIds))
      .orderBy(asc(items.number));
    
    const result: ItemWithPhotos[] = [];
    for (const item of matchingItems) {
      const itemPhotos = await db.select().from(photos)
        .where(eq(photos.itemId, item.id))
        .orderBy(asc(photos.position));
      result.push({ ...item, photos: itemPhotos });
    }
    
    return result;
  }

  async getItemsWithConflicts(): Promise<ItemWithPhotosAndLovers[]> {
    // Get items with 2+ love preferences
    const conflictItems = await db.execute(sql`
      SELECT 
        i.id,
        COUNT(p.id) as love_count,
        ARRAY_AGG(u.name ORDER BY u.name) as lovers
      FROM items i
      JOIN preferences p ON i.id = p.item_id AND p.level = 'love'
      JOIN users u ON p.user_id = u.id
      GROUP BY i.id
      HAVING COUNT(p.id) >= 2
      ORDER BY love_count DESC, i.number
    `);
    
    if (conflictItems.rows.length === 0) return [];
    
    const result: ItemWithPhotosAndLovers[] = [];
    for (const row of conflictItems.rows) {
      const itemId = row.id as number;
      const loveCount = Number(row.love_count);
      const lovers = row.lovers as string[];
      
      const [item] = await db.select().from(items).where(eq(items.id, itemId));
      if (!item) continue;
      
      const itemPhotos = await db.select().from(photos)
        .where(eq(photos.itemId, itemId))
        .orderBy(asc(photos.position));
      
      result.push({ ...item, photos: itemPhotos, lovers, loveCount });
    }
    
    return result;
  }

  async getItemsWithoutPreference(userId: number): Promise<ItemWithPhotos[]> {
    // Get items where user has NOT expressed any preference
    const itemsWithoutPref = await db.execute(sql`
      SELECT i.*
      FROM items i
      LEFT JOIN preferences p ON i.id = p.item_id AND p.user_id = ${userId}
      WHERE p.id IS NULL
      ORDER BY i.number
    `);
    
    if (itemsWithoutPref.rows.length === 0) return [];
    
    const result: ItemWithPhotos[] = [];
    for (const row of itemsWithoutPref.rows) {
      const itemId = row.id as number;
      const itemPhotos = await db.select().from(photos)
        .where(eq(photos.itemId, itemId))
        .orderBy(asc(photos.position));
      
      result.push({
        id: row.id as number,
        number: row.number as number,
        title: row.title as string | null,
        description: row.description as string | null,
        createdBy: row.created_by as number,
        createdAt: row.created_at ? new Date(row.created_at as string) : null,
        deletedAt: row.deleted_at ? new Date(row.deleted_at as string) : null,
        deletedBy: row.deleted_by as number | null,
        photos: itemPhotos
      });
    }
    
    return result;
  }

  async getItemsByUserAllPreferences(userId: number): Promise<ItemWithUserPreference[]> {
    // Get all items where user has ANY preference (love, maybe, or no)
    const itemsWithPrefs = await db.execute(sql`
      SELECT i.*, p.level as user_preference
      FROM items i
      JOIN preferences p ON i.id = p.item_id AND p.user_id = ${userId}
      ORDER BY i.number
    `);
    
    if (itemsWithPrefs.rows.length === 0) return [];
    
    const result: ItemWithUserPreference[] = [];
    for (const row of itemsWithPrefs.rows) {
      const itemId = row.id as number;
      const itemPhotos = await db.select().from(photos)
        .where(eq(photos.itemId, itemId))
        .orderBy(asc(photos.position));
      
      result.push({
        id: row.id as number,
        number: row.number as number,
        title: row.title as string | null,
        description: row.description as string | null,
        createdBy: row.created_by as number,
        createdAt: row.created_at ? new Date(row.created_at as string) : null,
        deletedAt: row.deleted_at ? new Date(row.deleted_at as string) : null,
        deletedBy: row.deleted_by as number | null,
        photos: itemPhotos,
        userPreference: row.user_preference as "love" | "maybe" | "no"
      });
    }
    
    return result;
  }
}

export const storage = new DatabaseStorage();
