import type Element from "@/domain/Element.js";

export default interface ElementRepository {
  getAllElements: () => Promise<Element[]>
}