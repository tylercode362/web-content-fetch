## ADDED Requirements

### Requirement: Show page reading progress without a fabricated total
The UI SHALL show the valid `chapter_images_read.pages` count as 已讀取 N 頁 without treating a Bridge resource limit as the actual page total.

#### Scenario: Reading pages while the total is unknown
- **Given** a running chapter read with `pages: 6`, `completed: 6`, and `total: 512`
- **When** the job snapshot is rendered
- **Then** the chapter detail shows 已讀取 6 頁 without a 512 denominator and preserves completed chapter counts

#### Scenario: Image count differs from page count
- **Given** a reader result with `pages: 2`, `completed: 10`, and `total: 10`
- **When** the job snapshot is rendered
- **Then** the reading label shows 2 pages rather than 10 pages

#### Scenario: Legacy or malformed progress
- **Given** an old event without pages or an invalid page value
- **When** the snapshot is rendered
- **Then** the UI shows 讀取中 without interpreting image counts or untrusted values as pages

#### Scenario: Subsequent verification and completion
- **Given** an assets_verified or asset_verified event, or a job that has finished reading
- **When** the snapshot is rendered
- **Then** existing image verification and completion displays remain intact
