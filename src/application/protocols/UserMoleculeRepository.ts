import type {
  SaveUserMoleculeInput,
  UpdateUserMoleculeInput,
  UserMoleculeRecord,
} from "../../domain/UserMolecule.js";

export default interface UserMoleculeRepository {
  listByUserId(userId: string): Promise<UserMoleculeRecord[]>;
  findById(userId: string, moleculeId: string): Promise<UserMoleculeRecord | null>;
  create(input: SaveUserMoleculeInput): Promise<UserMoleculeRecord>;
  update(
    userId: string,
    moleculeId: string,
    input: UpdateUserMoleculeInput,
  ): Promise<UserMoleculeRecord | null>;
  delete(userId: string, moleculeId: string): Promise<boolean>;
}
