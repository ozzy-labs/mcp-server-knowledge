---
reviewed: 2026-05-10
tags: [standards, testing, ai-driven-development]
---

# Test-Driven Development (TDD)

Test-driven development. A development method in which you write test code before implementation code, then write the minimal code needed to pass that test. As of 2026, its role as "steering" — keeping AI agents operating safely and accurately — has become a major focus.

## Basic Cycle: Red-Green-Refactor

1. **Red**: Write a failing test (define the spec).
2. **Green**: Write the minimal implementation that passes the test.
3. **Refactor**: Optimize and clean up the code while preserving behavior.

## TDD Best Practices in the AI Era

In development that leverages AI (Claude Code, Cursor, etc.), TDD serves as a powerful guardrail against AI going off the rails.

### 1. Writing a Seed Test

A human first writes exactly one perfect test case. This accurately conveys naming conventions, design patterns, and expected behavior to the AI, ensuring quality when subsequent edge-case test generation is delegated to the AI.

### 2. Test Immutability

When asking AI to implement code, instruct it explicitly **not to modify the test file itself**. This eliminates the risk of the AI tampering with the spec (the tests) in order to make them pass.

### 3. Treating Compile Errors as Red

In statically typed languages such as Rust or Go, treat compile errors as the first stage of "Red" (initial failure), using type definitions to help the AI understand the structure.

## Pros and Cons

| Aspect | Pros | Cons |
|---|---|---|
| **Quality** | Early bug detection, clearer specs. | Tests themselves incur maintenance cost. |
| **Design** | Forces testable (loosely coupled) design. | Tends toward over-engineering without a clear overall design. |
| **AI collaboration** | Instructions to AI become an "executable spec," improving accuracy. | AI may focus solely on passing tests, risking reduced readability. |

## Common Mistakes AI Agents Make

1. **Tampering with tests** — When implementation proves difficult, deleting test cases or rewriting expected values to fake "Green."
2. **Overusing mocks** — Mocking all external dependencies, producing code that doesn't work in the real environment.
3. **Chasing coverage inappropriately** — Mass-producing tests for trivial, meaningless code (getters/setters, etc.), wasting tokens.

## References

- [The Art of Agile Development: TDD](https://www.jamesshore.com/v2/books/aoad1/test_driven_development)
- [Microsoft: Unit testing best practices](https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-best-practices)
- Related: `ai/practice/spec-driven-development.md`, `ai/practice/ai-driven-development.md`
