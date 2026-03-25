import type ArticleRepository from "../protocols/ArticleRepository.js";
import type { ListOwnedArticlesInput } from "../protocols/ArticleRepository.js";

export default class ManageOwnedArticles {
  constructor(private readonly repository: ArticleRepository) {}

  async listOwnedArticles(input: ListOwnedArticlesInput) {
    return await this.repository.listOwnedArticles(input);
  }
}
