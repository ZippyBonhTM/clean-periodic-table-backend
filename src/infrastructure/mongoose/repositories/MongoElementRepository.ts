import type ElementRepository from "../../../application/protocols/ElementRepository.js";
import Element from "../../../domain/Element.js";
import PeriodicTableModel from "../models/PeriodicTableModel.js";

export default class MongoElementRepository implements ElementRepository {
  async getAllElements(): Promise<Element[]> {
    const periodicTable = await PeriodicTableModel.findOne({}, { elements: 1, _id: 0 })
      .lean()
      .exec();

    if (periodicTable === null) {
      return [];
    }

    return periodicTable.elements.map((element) => new Element(element.symbol));
  }
}
