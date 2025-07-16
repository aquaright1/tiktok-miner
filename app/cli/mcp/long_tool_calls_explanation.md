# Shadow Bee Tool Performance: Why Some Calls Take Longer

## Overview

You may notice that certain `tiktok-miner` tool calls, particularly those related to fetching contributors like `get-contributors-from-trending-repos`, take a significant amount of time to complete. This is not the result of an error, bug, or a failing process that is retrying. Instead, it is the expected behavior of a powerful, but intensive, data enrichment process happening in the background.

## The Bottleneck: Deep User Enrichment & Email Inference

The core reason for the extended duration is the tool's **deep user enrichment** feature. A simple fetch of repositories and their contributors is very fast. However, for each contributor found, the system performs a deep dive to gather more data, especially if their email address is not publicly available on their GitHub profile.

### Breakdown of the Process for a Single Contributor

When the tool processes a contributor, it performs the following steps:

1.  **Initial Profile Fetch (Fast):** Gets the basic user data from the GitHub API.

2.  **Email Inference (Slow & API-Intensive):** If a public email is not found on the profile, the tool initiates a comprehensive search:
    *   **Fetches all owned repositories** for that user.
    *   **Fetches all forked repositories** for that user.
    *   Iterates through these repositories and **inspects commit histories** one by one, looking for an email address in the commit data.

3.  **Location & Contribution Analysis (The Amplifier):** To build a more complete profile for analysis (including fields like `inferredLocation`), the tool goes a step further and analyzes the user's own projects by:
    *   Fetching the **list of contributors** for *their* top repositories.
    *   Fetching **commit statistics** for those repositories.

### The "API Call Explosion"

This nested, recursive process is the source of the high number of API calls observed in the logs.

*   A simple fetch of 10 repositories with 10 contributors each should ideally be around **100-200 API calls**.
*   However, due to the deep enrichment process, each contributor can trigger an additional 10-20 API calls (or more).

As seen in the logs for a single `get-contributors-from-trending-repos` call, this can result in **over 600 API calls**, turning a seemingly simple request into a multi-minute operation.

## Conclusion

The long execution time is a trade-off for much richer, more detailed data that would otherwise be unavailable. The system is performing thousands of micro-tasks in the background to deliver a high-quality, comprehensive analysis. 