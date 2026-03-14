import { Router, type Request, type RequestHandler } from "express";

import type ManageUserMolecules from "../../application/usecases/ManageUserMolecules.js";
import type {
  BondOrder,
  MoleculeAtom,
  MoleculeBond,
  MoleculeEditorState,
  MoleculeEditorViewMode,
  MoleculeModel,
  SaveUserMoleculeInput,
  UpdateUserMoleculeInput,
  UserMoleculeRecord,
} from "../../domain/UserMolecule.js";
import { AppError, isAppError } from "../errors/AppError.js";

type CreateMoleculesRoutesInput = {
  manageUserMolecules: ManageUserMolecules;
  authMiddleware?: RequestHandler;
};

type MoleculeResponse = {
  id: string;
  name: string | null;
  educationalDescription: string | null;
  molecule: MoleculeModel;
  editorState: MoleculeEditorState;
  summary: UserMoleculeRecord["summary"];
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_EDITOR_STATE: MoleculeEditorState = {
  selectedAtomId: null,
  activeView: "editor",
  bondOrder: 1,
  canvasViewport: {
    offsetX: 0,
    offsetY: 0,
    scale: 1,
  },
};

function createValidationError(message: string, details?: unknown): AppError {
  return new AppError({
    statusCode: 400,
    code: "INVALID_MOLECULE_PAYLOAD",
    message,
    publicMessage: message,
    layer: "http",
    details,
  });
}

function requireAuthenticationMiddleware(authMiddleware?: RequestHandler): RequestHandler[] {
  if (authMiddleware !== undefined) {
    return [authMiddleware];
  }

  return [(_request, response) => {
    response.status(503).json({ message: "Molecule persistence requires authentication." });
  }];
}

function getAuthenticatedUserId(request: Request): string {
  const userId = request.auth?.userId;

  if (userId === undefined || userId.trim().length === 0) {
    throw new AppError({
      statusCode: 500,
      code: "AUTH_CONTEXT_MISSING",
      message: "Authenticated user context was not attached to the request.",
      publicMessage: "Authentication context missing.",
      layer: "http",
    });
  }

  return userId;
}

function getMoleculeIdParam(request: Request): string {
  const value = request.params.moleculeId;

  if (typeof value !== "string" || value.trim().length === 0) {
    throw createValidationError("moleculeId route param is required.");
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseFiniteNumber(value: unknown, fieldPath: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw createValidationError(`${fieldPath} must be a finite number.`);
  }

  return value;
}

function parseInteger(value: unknown, fieldPath: string): number {
  const parsed = parseFiniteNumber(value, fieldPath);

  if (!Number.isInteger(parsed)) {
    throw createValidationError(`${fieldPath} must be an integer.`);
  }

  return parsed;
}

function parseString(value: unknown, fieldPath: string): string {
  if (typeof value !== "string") {
    throw createValidationError(`${fieldPath} must be a string.`);
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw createValidationError(`${fieldPath} must not be empty.`);
  }

  return trimmed;
}

function parseNullableString(value: unknown, fieldPath: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw createValidationError(`${fieldPath} must be a string or null.`);
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parseShells(value: unknown, fieldPath: string): number[] {
  if (!Array.isArray(value)) {
    throw createValidationError(`${fieldPath} must be an array of integers.`);
  }

  return value.map((entry, index) => parseInteger(entry, `${fieldPath}[${String(index)}]`));
}

function parseBondOrder(value: unknown, fieldPath: string): BondOrder {
  const parsed = parseInteger(value, fieldPath);

  if (parsed !== 1 && parsed !== 2 && parsed !== 3) {
    throw createValidationError(`${fieldPath} must be 1, 2, or 3.`);
  }

  return parsed;
}

function parseEditorViewMode(value: unknown, fieldPath: string): MoleculeEditorViewMode {
  const parsed = parseString(value, fieldPath);

  if (parsed !== "editor" && parsed !== "structural" && parsed !== "simplified" && parsed !== "stick") {
    throw createValidationError(`${fieldPath} must be editor, structural, simplified, or stick.`);
  }

  return parsed;
}

function parseAtom(value: unknown, index: number): MoleculeAtom {
  if (!isRecord(value)) {
    throw createValidationError(`molecule.atoms[${String(index)}] must be an object.`);
  }

  const element = value.element;

  if (!isRecord(element)) {
    throw createValidationError(`molecule.atoms[${String(index)}].element must be an object.`);
  }

  return {
    id: parseString(value.id, `molecule.atoms[${String(index)}].id`),
    x: parseFiniteNumber(value.x, `molecule.atoms[${String(index)}].x`),
    y: parseFiniteNumber(value.y, `molecule.atoms[${String(index)}].y`),
    element: {
      number: parseInteger(element.number, `molecule.atoms[${String(index)}].element.number`),
      symbol: parseString(element.symbol, `molecule.atoms[${String(index)}].element.symbol`),
      name: parseString(element.name, `molecule.atoms[${String(index)}].element.name`),
      category: parseString(element.category, `molecule.atoms[${String(index)}].element.category`),
      group: parseInteger(element.group, `molecule.atoms[${String(index)}].element.group`),
      shells: parseShells(element.shells, `molecule.atoms[${String(index)}].element.shells`),
    },
  };
}

function parseBond(value: unknown, index: number): MoleculeBond {
  if (!isRecord(value)) {
    throw createValidationError(`molecule.bonds[${String(index)}] must be an object.`);
  }

  return {
    id: parseString(value.id, `molecule.bonds[${String(index)}].id`),
    sourceId: parseString(value.sourceId, `molecule.bonds[${String(index)}].sourceId`),
    targetId: parseString(value.targetId, `molecule.bonds[${String(index)}].targetId`),
    order: parseBondOrder(value.order, `molecule.bonds[${String(index)}].order`),
  };
}

function parseMolecule(value: unknown): MoleculeModel {
  if (!isRecord(value)) {
    throw createValidationError("molecule must be an object.");
  }

  if (!Array.isArray(value.atoms)) {
    throw createValidationError("molecule.atoms must be an array.");
  }

  if (!Array.isArray(value.bonds)) {
    throw createValidationError("molecule.bonds must be an array.");
  }

  const atoms = value.atoms.map((atom, index) => parseAtom(atom, index));
  const bonds = value.bonds.map((bond, index) => parseBond(bond, index));
  const atomIds = new Set<string>();
  const bondIds = new Set<string>();

  atoms.forEach((atom) => {
    if (atomIds.has(atom.id)) {
      throw createValidationError(`Atom id ${atom.id} is duplicated.`);
    }

    atomIds.add(atom.id);
  });

  bonds.forEach((bond) => {
    if (bondIds.has(bond.id)) {
      throw createValidationError(`Bond id ${bond.id} is duplicated.`);
    }

    if (!atomIds.has(bond.sourceId) || !atomIds.has(bond.targetId)) {
      throw createValidationError(`Bond ${bond.id} references an unknown atom.`);
    }

    if (bond.sourceId === bond.targetId) {
      throw createValidationError(`Bond ${bond.id} cannot connect an atom to itself.`);
    }

    bondIds.add(bond.id);
  });

  return { atoms, bonds };
}

function parseEditorState(value: unknown): MoleculeEditorState {
  if (value === undefined || value === null) {
    return structuredClone(DEFAULT_EDITOR_STATE);
  }

  if (!isRecord(value)) {
    throw createValidationError("editorState must be an object.");
  }

  const canvasViewport = value.canvasViewport;

  if (!isRecord(canvasViewport)) {
    throw createValidationError("editorState.canvasViewport must be an object.");
  }

  const selectedAtomId = value.selectedAtomId;

  if (selectedAtomId !== null && selectedAtomId !== undefined && typeof selectedAtomId !== "string") {
    throw createValidationError("editorState.selectedAtomId must be a string or null.");
  }

  return {
    selectedAtomId: selectedAtomId === undefined ? null : selectedAtomId,
    activeView: parseEditorViewMode(value.activeView, "editorState.activeView"),
    bondOrder: parseBondOrder(value.bondOrder, "editorState.bondOrder"),
    canvasViewport: {
      offsetX: parseFiniteNumber(canvasViewport.offsetX, "editorState.canvasViewport.offsetX"),
      offsetY: parseFiniteNumber(canvasViewport.offsetY, "editorState.canvasViewport.offsetY"),
      scale: parseFiniteNumber(canvasViewport.scale, "editorState.canvasViewport.scale"),
    },
  };
}

function parseCreateInput(body: unknown, userId: string): SaveUserMoleculeInput {
  if (!isRecord(body)) {
    throw createValidationError("Request body must be an object.");
  }

  return {
    userId,
    name: parseNullableString(body.name, "name"),
    educationalDescription: parseNullableString(
      body.educationalDescription,
      "educationalDescription",
    ),
    molecule: parseMolecule(body.molecule),
    editorState: parseEditorState(body.editorState),
  };
}

function parseUpdateInput(body: unknown): UpdateUserMoleculeInput {
  if (!isRecord(body)) {
    throw createValidationError("Request body must be an object.");
  }

  return {
    name: parseNullableString(body.name, "name"),
    educationalDescription: parseNullableString(
      body.educationalDescription,
      "educationalDescription",
    ),
    molecule: parseMolecule(body.molecule),
    editorState: parseEditorState(body.editorState),
  };
}

function toResponse(record: UserMoleculeRecord): MoleculeResponse {
  return {
    id: record.id,
    name: record.name,
    educationalDescription: record.educationalDescription,
    molecule: record.molecule,
    editorState: record.editorState,
    summary: record.summary,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function createMoleculesRoutes({
  manageUserMolecules,
  authMiddleware,
}: CreateMoleculesRoutesInput): Router {
  const router = Router();
  const authHandlers = requireAuthenticationMiddleware(authMiddleware);

  router.get("/molecules", ...authHandlers, async (request, response, next) => {
    try {
      const userId = getAuthenticatedUserId(request);
      const molecules = await manageUserMolecules.list(userId);
      response.status(200).json(molecules.map((molecule) => toResponse(molecule)));
    } catch (error: unknown) {
      if (isAppError(error)) {
        next(error);
        return;
      }

      next(
        new AppError({
          statusCode: 500,
          code: "LIST_USER_MOLECULES_FAILED",
          message: error instanceof Error ? error.message : String(error),
          publicMessage: "Internal error while listing saved molecules.",
          layer: "application",
          cause: error,
        }),
      );
    }
  });

  router.get("/molecules/:moleculeId", ...authHandlers, async (request, response, next) => {
    try {
      const userId = getAuthenticatedUserId(request);
      const moleculeId = getMoleculeIdParam(request);
      const molecule = await manageUserMolecules.get(userId, moleculeId);

      if (molecule === null) {
        next(
          new AppError({
            statusCode: 404,
            code: "USER_MOLECULE_NOT_FOUND",
            message: `Molecule ${moleculeId} was not found for user ${userId}.`,
            publicMessage: "Saved molecule not found.",
            layer: "application",
          }),
        );
        return;
      }

      response.status(200).json(toResponse(molecule));
    } catch (error: unknown) {
      if (isAppError(error)) {
        next(error);
        return;
      }

      next(
        new AppError({
          statusCode: 500,
          code: "GET_USER_MOLECULE_FAILED",
          message: error instanceof Error ? error.message : String(error),
          publicMessage: "Internal error while loading the saved molecule.",
          layer: "application",
          cause: error,
        }),
      );
    }
  });

  router.post("/molecules", ...authHandlers, async (request, response, next) => {
    try {
      const userId = getAuthenticatedUserId(request);
      const input = parseCreateInput(request.body, userId);
      const created = await manageUserMolecules.create(input);
      response.status(201).json(toResponse(created));
    } catch (error: unknown) {
      if (isAppError(error)) {
        next(error);
        return;
      }

      next(
        new AppError({
          statusCode: 500,
          code: "CREATE_USER_MOLECULE_FAILED",
          message: error instanceof Error ? error.message : String(error),
          publicMessage: "Internal error while saving the molecule.",
          layer: "application",
          cause: error,
        }),
      );
    }
  });

  router.put("/molecules/:moleculeId", ...authHandlers, async (request, response, next) => {
    try {
      const userId = getAuthenticatedUserId(request);
      const moleculeId = getMoleculeIdParam(request);
      const input = parseUpdateInput(request.body);
      const updated = await manageUserMolecules.update(userId, moleculeId, input);

      if (updated === null) {
        next(
          new AppError({
            statusCode: 404,
            code: "USER_MOLECULE_NOT_FOUND",
            message: `Molecule ${moleculeId} was not found for user ${userId}.`,
            publicMessage: "Saved molecule not found.",
            layer: "application",
          }),
        );
        return;
      }

      response.status(200).json(toResponse(updated));
    } catch (error: unknown) {
      if (isAppError(error)) {
        next(error);
        return;
      }

      next(
        new AppError({
          statusCode: 500,
          code: "UPDATE_USER_MOLECULE_FAILED",
          message: error instanceof Error ? error.message : String(error),
          publicMessage: "Internal error while updating the molecule.",
          layer: "application",
          cause: error,
        }),
      );
    }
  });

  router.delete("/molecules/:moleculeId", ...authHandlers, async (request, response, next) => {
    try {
      const userId = getAuthenticatedUserId(request);
      const moleculeId = getMoleculeIdParam(request);
      const deleted = await manageUserMolecules.delete(userId, moleculeId);

      if (!deleted) {
        next(
          new AppError({
            statusCode: 404,
            code: "USER_MOLECULE_NOT_FOUND",
            message: `Molecule ${moleculeId} was not found for user ${userId}.`,
            publicMessage: "Saved molecule not found.",
            layer: "application",
          }),
        );
        return;
      }

      response.status(204).send();
    } catch (error: unknown) {
      if (isAppError(error)) {
        next(error);
        return;
      }

      next(
        new AppError({
          statusCode: 500,
          code: "DELETE_USER_MOLECULE_FAILED",
          message: error instanceof Error ? error.message : String(error),
          publicMessage: "Internal error while deleting the molecule.",
          layer: "application",
          cause: error,
        }),
      );
    }
  });

  return router;
}

export { createMoleculesRoutes };
export type { CreateMoleculesRoutesInput, MoleculeResponse };
