import type { MapFilters, ResourceCardData, StartupProfileData } from "@/lib/schemas";

function includesIgnoreCase(value: string, query: string): boolean {
  return value.toLowerCase().includes(query.toLowerCase());
}

function parseEmployeeRange(value: string | null): { min: number; max: number } | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/,/g, "").trim().toLowerCase();
  const plusMatch = normalized.match(/^(\d+)\+$/);
  if (plusMatch) {
    const min = Number(plusMatch[1]);
    return Number.isFinite(min) ? { min, max: Number.POSITIVE_INFINITY } : null;
  }

  const rangeMatch = normalized.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return { min, max };
    }
  }

  const exactMatch = normalized.match(/^(\d+)$/);
  if (exactMatch) {
    const valueNumber = Number(exactMatch[1]);
    if (Number.isFinite(valueNumber)) {
      return { min: valueNumber, max: valueNumber };
    }
  }

  return null;
}

export function filterResources(resources: ResourceCardData[], filters: MapFilters | null): ResourceCardData[] {
  if (!filters || filters.clearFilters) {
    return resources;
  }

  return resources.filter((resource) => {
    if (filters.nearbyResourceIds !== undefined) {
      const nearbyMatch = filters.nearbyResourceIds.includes(resource.id);
      if (!nearbyMatch) {
        return false;
      }
    }

    if (filters.resourceCategories && filters.resourceCategories.length > 0) {
      const categoryMatch = filters.resourceCategories.includes(resource.category);
      if (!categoryMatch) {
        return false;
      }
    }

    if (filters.states && filters.states.length > 0) {
      const stateMatch = filters.states.some((state) => resource.state.toLowerCase() === state.toLowerCase());
      if (!stateMatch) {
        return false;
      }
    }

    if (filters.keywords && filters.keywords.length > 0) {
      const keywordMatch = filters.keywords.some(
        (keyword) =>
          includesIgnoreCase(resource.name, keyword) ||
          includesIgnoreCase(resource.description, keyword) ||
          resource.tags.some((tag) => includesIgnoreCase(tag, keyword))
      );
      if (!keywordMatch) {
        return false;
      }
    }

    return true;
  });
}

export function filterStartups(startups: StartupProfileData[], filters: MapFilters | null): StartupProfileData[] {
  if (!filters || filters.clearFilters) {
    return startups;
  }

  return startups.filter((startup) => {
    if (filters.nearbyStartupIds !== undefined) {
      const nearbyMatch = filters.nearbyStartupIds.includes(startup.id);
      if (!nearbyMatch) {
        return false;
      }
    }

    if (filters.states && filters.states.length > 0) {
      const address = startup.address?.toLowerCase() ?? "";
      const stateMatch = filters.states.some((state) => {
        const normalized = state.toLowerCase();
        if (normalized.length === 2) {
          return address.includes(` ${normalized} `) || address.endsWith(` ${normalized}`);
        }
        return address.includes(normalized);
      });
      if (!stateMatch) {
        return false;
      }
    }

    if (filters.startupStageKeywords && filters.startupStageKeywords.length > 0) {
      const haystack = `${startup.name} ${startup.description ?? ""}`.toLowerCase();
      const stageMatch = filters.startupStageKeywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
      if (!stageMatch) {
        return false;
      }
    }

    if (filters.employeeMin !== undefined || filters.employeeMax !== undefined) {
      const employeeRange = parseEmployeeRange(startup.employees);
      if (!employeeRange) {
        return false;
      }

      if (filters.employeeMin !== undefined && employeeRange.max < filters.employeeMin) {
        return false;
      }

      if (filters.employeeMax !== undefined && employeeRange.min > filters.employeeMax) {
        return false;
      }
    }

    if (filters.sectors && filters.sectors.length > 0) {
      const sectorMatch = filters.sectors.some((sector) => startup.sector?.toLowerCase().includes(sector.toLowerCase()));
      if (!sectorMatch) {
        return false;
      }
    }

    if (filters.keywords && filters.keywords.length > 0) {
      const keywordMatch = filters.keywords.some(
        (keyword) =>
          includesIgnoreCase(startup.name, keyword) ||
          includesIgnoreCase(startup.description ?? "", keyword)
      );
      if (!keywordMatch) {
        return false;
      }
    }

    return true;
  });
}
