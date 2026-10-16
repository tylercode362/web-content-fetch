## ADDED Requirements

### Requirement: 正式映像只含正式程式與執行期依賴
The runtime image SHALL exclude repository tests, engineering documents, development tools and package managers while preserving required runtime modules and kepubify.

#### Scenario: 檢查實際正式映像
- **GIVEN** a freshly built runtime image
- **WHEN** the production content gate runs
- **THEN** runtime dependencies and kepubify are available and tests, OpenSpec, npm, Corepack and Yarn are absent

#### Scenario: 完整輸出回歸
- **GIVEN** the runtime image with read-only synthetic test sources
- **WHEN** the full test suite runs in an isolated container
- **THEN** EPUB and KEPUB assertions pass without production state or credentials
