# Founder GPS API Reference

Generated from docs/contracts.json (version 1.0.0).

## Error Model

All services use a shared envelope:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Human readable message", "details": {} } }
```

## resource-service

Base path: /

### GET /resources

- Summary: List startup resources with optional filters
- Request contract: query: category, city, stage, industry, q, limit, offset, lat, lng, radiusMiles
- Success contract: { resources: StartupResource[], count: number }
- Error codes: VALIDATION_ERROR

### GET /resources/:id

- Summary: Get resource by id
- Request contract: params: { id: uuid }
- Success contract: StartupResource
- Error codes: VALIDATION_ERROR, NOT_FOUND

### POST /resources/search

- Summary: Search resources by structured body
- Request contract: body: same filters as GET /resources
- Success contract: { resources: StartupResource[], count: number }
- Error codes: VALIDATION_ERROR

### GET /resources/map-data

- Summary: Get GeoJSON payload for map rendering
- Request contract: query: same filters as GET /resources
- Success contract: ResourceFeatureCollection
- Error codes: VALIDATION_ERROR

### GET /resources/categories

- Summary: List available resource categories
- Request contract: none
- Success contract: { categories: string[] }
- Error codes: None

## intelligence-service

Base path: /

### POST /intelligence/analyze-founder

- Summary: Generate structured founder analysis
- Request contract: body: FounderAnalysisInputSchema
- Success contract: { analysis, snapshotId, metadata }
- Error codes: VALIDATION_ERROR, DEPENDENCY_UNAVAILABLE

### POST /intelligence/explain-recommendation

- Summary: Generate human-readable recommendation explanation
- Request contract: body: ExplainRecommendationInputSchema
- Success contract: { explanation, metadata }
- Error codes: VALIDATION_ERROR, DEPENDENCY_UNAVAILABLE

### POST /intelligence/generate-roadmap

- Summary: Generate roadmap based on analysis and recommendations
- Request contract: body: RoadmapInputSchema
- Success contract: { roadmap, metadata }
- Error codes: VALIDATION_ERROR, DEPENDENCY_UNAVAILABLE

### GET /intelligence/analysis/:snapshotId

- Summary: Get saved analysis snapshot
- Request contract: params: { snapshotId: uuid }
- Success contract: analysis snapshot
- Error codes: VALIDATION_ERROR, NOT_FOUND

## recommendation-service

Base path: /

### POST /recommendations/generate

- Summary: Generate recommendations end-to-end
- Request contract: body: GenerateRecommendationsRequestSchema
- Success contract: { recommendations, count }
- Error codes: VALIDATION_ERROR

### POST /recommendations/rank

- Summary: Rank pre-fetched resources with deterministic scoring
- Request contract: body: RankRecommendationsRequestSchema
- Success contract: { recommendations, count }
- Error codes: VALIDATION_ERROR

### GET /recommendations/replay/:founderProfileId

- Summary: Replay recommendations for a founder profile
- Request contract: params: { founderProfileId: uuid }
- Success contract: { recommendations, count }
- Error codes: VALIDATION_ERROR

## routing-service

Base path: /

### POST /routing/route

- Summary: Compute route geometry for ordered coordinates
- Request contract: body: RouteRequestSchema
- Success contract: route payload
- Error codes: VALIDATION_ERROR, DEPENDENCY_UNAVAILABLE

### POST /routing/matrix

- Summary: Compute travel time matrix
- Request contract: body: MatrixRequestSchema
- Success contract: matrix payload
- Error codes: VALIDATION_ERROR, DEPENDENCY_UNAVAILABLE

### POST /routing/trip

- Summary: Optimize trip order
- Request contract: body: TripRequestSchema
- Success contract: trip payload
- Error codes: VALIDATION_ERROR, DEPENDENCY_UNAVAILABLE

### POST /routing/founder-path

- Summary: Compute founder-optimized route over ranked resources
- Request contract: body: FounderPathRequestSchema
- Success contract: FounderRoute
- Error codes: VALIDATION_ERROR, DEPENDENCY_UNAVAILABLE

