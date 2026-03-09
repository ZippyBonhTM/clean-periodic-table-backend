import type UserMoleculeRepository from "../../application/protocols/UserMoleculeRepository.js";
import {
  buildMoleculeSummary,
  type SaveUserMoleculeInput,
  type UpdateUserMoleculeInput,
  type UserMoleculeRecord,
} from "../../domain/UserMolecule.js";

function cloneRecord(record: UserMoleculeRecord): UserMoleculeRecord {
  return structuredClone(record);
}

export default class InMemoryUserMoleculeRepository implements UserMoleculeRepository {
  private readonly records = new Map<string, UserMoleculeRecord>();

  private sequence = 0;

  async listByUserId(userId: string): Promise<UserMoleculeRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.userId === userId)
      .sort((first, second) => second.updatedAt.getTime() - first.updatedAt.getTime())
      .map((record) => cloneRecord(record));
  }

  async findById(userId: string, moleculeId: string): Promise<UserMoleculeRecord | null> {
    const record = this.records.get(moleculeId);

    if (record === undefined || record.userId !== userId) {
      return null;
    }

    return cloneRecord(record);
  }

  async create(input: SaveUserMoleculeInput): Promise<UserMoleculeRecord> {
    this.sequence += 1;
    const now = new Date();
    const record: UserMoleculeRecord = {
      id: `molecule-${String(this.sequence)}`,
      ...structuredClone(input),
      summary: buildMoleculeSummary(input.molecule),
      createdAt: now,
      updatedAt: now,
    };

    this.records.set(record.id, record);
    return cloneRecord(record);
  }

  async update(
    userId: string,
    moleculeId: string,
    input: UpdateUserMoleculeInput,
  ): Promise<UserMoleculeRecord | null> {
    const existingRecord = this.records.get(moleculeId);

    if (existingRecord === undefined || existingRecord.userId !== userId) {
      return null;
    }

    const updatedRecord: UserMoleculeRecord = {
      ...existingRecord,
      ...structuredClone(input),
      summary: buildMoleculeSummary(input.molecule),
      updatedAt: new Date(),
    };

    this.records.set(moleculeId, updatedRecord);
    return cloneRecord(updatedRecord);
  }

  async delete(userId: string, moleculeId: string): Promise<boolean> {
    const existingRecord = this.records.get(moleculeId);

    if (existingRecord === undefined || existingRecord.userId !== userId) {
      return false;
    }

    this.records.delete(moleculeId);
    return true;
  }
}
