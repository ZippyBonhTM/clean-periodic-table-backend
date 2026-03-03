import type Element from "../../domain/Element.js";
import type ElementRepository from "../protocols/ElementRepository.js";

class ListAllElements {
  constructor(private readonly elementRepository: ElementRepository) { }

  async list(): Promise<Element[]> {
    return await this.elementRepository.getAllElements();
  }
}

export default ListAllElements;
