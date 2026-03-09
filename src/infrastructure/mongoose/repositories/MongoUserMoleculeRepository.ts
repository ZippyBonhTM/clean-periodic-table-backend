import mongoose from "mongoose";

import type UserMoleculeRepository from "../../../application/protocols/UserMoleculeRepository.js";
import {
  buildMoleculeSummary,
  type SaveUserMoleculeInput,
  type UpdateUserMoleculeInput,
  type UserMoleculeRecord,
} from "../../../domain/UserMolecule.js";
import UserMoleculeModel from "../models/UserMoleculeModel.js";

type StoredUserMoleculeDocument = SaveUserMoleculeInput & {
  _id: mongoose.Types.ObjectId;
  summary: UserMoleculeRecord["summary"];
  createdAt: Date;
  updatedAt: Date;
};

function mapDocument(document: StoredUserMoleculeDocument): UserMoleculeRecord {
  return {
    id: String(document._id),
    userId: document.userId,
    name: document.name,
    educationalDescription: document.educationalDescription,
    molecule: structuredClone(document.molecule),
    editorState: structuredClone(document.editorState),
    summary: structuredClone(document.summary),
    createdAt: new Date(document.createdAt),
    updatedAt: new Date(document.updatedAt),
  };
}

export default class MongoUserMoleculeRepository implements UserMoleculeRepository {
  async listByUserId(userId: string): Promise<UserMoleculeRecord[]> {
    const documents = (await UserMoleculeModel.find({ userId }, { __v: 0 })
      .sort({ updatedAt: -1 })
      .lean()
      .exec()) as StoredUserMoleculeDocument[];

    return documents.map((document) => mapDocument(document));
  }

  async findById(userId: string, moleculeId: string): Promise<UserMoleculeRecord | null> {
    if (!mongoose.isValidObjectId(moleculeId)) {
      return null;
    }

    const document = (await UserMoleculeModel.findOne(
      { _id: moleculeId, userId },
      { __v: 0 },
    )
      .lean()
      .exec()) as StoredUserMoleculeDocument | null;

    return document === null ? null : mapDocument(document);
  }

  async create(input: SaveUserMoleculeInput): Promise<UserMoleculeRecord> {
    const created = await UserMoleculeModel.create({
      ...input,
      summary: buildMoleculeSummary(input.molecule),
    });

    return await this.findCreatedDocument(String(created._id));
  }

  async update(
    userId: string,
    moleculeId: string,
    input: UpdateUserMoleculeInput,
  ): Promise<UserMoleculeRecord | null> {
    if (!mongoose.isValidObjectId(moleculeId)) {
      return null;
    }

    const updated = (await UserMoleculeModel.findOneAndUpdate(
      { _id: moleculeId, userId },
      {
        $set: {
          ...input,
          summary: buildMoleculeSummary(input.molecule),
        },
      },
      {
        new: true,
        projection: { __v: 0 },
      },
    )
      .lean()
      .exec()) as StoredUserMoleculeDocument | null;

    return updated === null ? null : mapDocument(updated);
  }

  async delete(userId: string, moleculeId: string): Promise<boolean> {
    if (!mongoose.isValidObjectId(moleculeId)) {
      return false;
    }

    const deleted = await UserMoleculeModel.deleteOne({ _id: moleculeId, userId }).exec();
    return deleted.deletedCount === 1;
  }

  private async findCreatedDocument(moleculeId: string): Promise<UserMoleculeRecord> {
    const document = (await UserMoleculeModel.findById(moleculeId, { __v: 0 })
      .lean()
      .exec()) as StoredUserMoleculeDocument | null;

    if (document === null) {
      throw new Error(`Created molecule ${moleculeId} could not be reloaded.`);
    }

    return mapDocument(document);
  }
}
