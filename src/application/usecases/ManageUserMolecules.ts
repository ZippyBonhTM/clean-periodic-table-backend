import type UserMoleculeRepository from "../protocols/UserMoleculeRepository.js";
import type {
  SaveUserMoleculeInput,
  UpdateUserMoleculeInput,
  UserMoleculeRecord,
} from "../../domain/UserMolecule.js";

export default class ManageUserMolecules {
  constructor(private readonly repository: UserMoleculeRepository) {}

  async list(userId: string): Promise<UserMoleculeRecord[]> {
    return await this.repository.listByUserId(userId);
  }

  async get(userId: string, moleculeId: string): Promise<UserMoleculeRecord | null> {
    return await this.repository.findById(userId, moleculeId);
  }

  async create(input: SaveUserMoleculeInput): Promise<UserMoleculeRecord> {
    return await this.repository.create(input);
  }

  async update(
    userId: string,
    moleculeId: string,
    input: UpdateUserMoleculeInput,
  ): Promise<UserMoleculeRecord | null> {
    return await this.repository.update(userId, moleculeId, input);
  }

  async delete(userId: string, moleculeId: string): Promise<boolean> {
    return await this.repository.delete(userId, moleculeId);
  }
}
