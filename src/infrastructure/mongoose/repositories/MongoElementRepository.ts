import type ElementRepository from "../../../application/protocols/ElementRepository.js";
import Element from "../../../domain/Element.js";
import ElementModel from "../models/ElementModel.js";

export default class MongoElementRepository implements ElementRepository {
  async getAllElements(): Promise<Element[]> {
    const storedElements = await ElementModel.find({}, { _id: 0, __v: 0 })
      .sort({ number: 1 })
      .lean()
      .exec();

    if (storedElements.length === 0) {
      return [];
    }

    return storedElements.map((element) => new Element(element));
  }
}
