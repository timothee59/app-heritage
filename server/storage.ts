import { type User, type InsertUser } from "@shared/schema";

// Interface de stockage pour les opérations CRUD
export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByName(name: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private nextId: number;

  constructor() {
    this.users = new Map();
    this.nextId = 1;
    
    // Données de test pour la famille
    this.seedTestData();
  }

  private seedTestData() {
    const testUsers: InsertUser[] = [
      { name: "Marie", role: "parent" },
      { name: "Jean", role: "parent" },
      { name: "Sophie", role: "enfant" },
      { name: "Pierre", role: "enfant" },
      { name: "Claire", role: "enfant" },
    ];

    testUsers.forEach((user) => {
      const id = this.nextId++;
      this.users.set(id, {
        ...user,
        id,
        createdAt: new Date(),
      });
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByName(name: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.name.toLowerCase() === name.toLowerCase(),
    );
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort((a, b) => 
      a.name.localeCompare(b.name)
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.nextId++;
    const user: User = { 
      ...insertUser, 
      id,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }
}

export const storage = new MemStorage();
