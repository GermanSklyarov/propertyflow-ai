import { Inject, Injectable } from "@nestjs/common";
import type { RecordSearchEventInput, SearchEventRepository } from "../domain/search-event.repository.js";
import { SEARCH_EVENT_REPOSITORY } from "../domain/search-event.repository.js";

@Injectable()
export class SearchObservabilityService {
  constructor(@Inject(SEARCH_EVENT_REPOSITORY) private readonly events: SearchEventRepository) {}

  record(input: RecordSearchEventInput): Promise<void> {
    return this.events.record({
      ...input,
      latencyMs: Math.max(0, Math.round(input.latencyMs))
    });
  }
}
