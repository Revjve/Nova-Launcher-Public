import { DEFAULT_NEWS } from "../../../shared/constants";
import type { NewsItem } from "../../../shared/types";

export class NewsService {
  async getNews(): Promise<NewsItem[]> {
    return DEFAULT_NEWS;
  }
}
