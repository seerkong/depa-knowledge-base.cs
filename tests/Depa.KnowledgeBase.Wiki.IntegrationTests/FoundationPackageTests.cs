using Depa.KnowledgeBase.Wiki.Core;
using Depa.KnowledgeBase.Wiki.Indexing;
using Depa.KnowledgeBase.Wiki.SemanticParsing;
using Depa.KnowledgeBase.Wiki.VectorSearch;

namespace Depa.KnowledgeBase.Wiki.IntegrationTests;

/// <summary>
/// Focused migration coverage for the parser, vector and indexing foundation packages.
/// These cases are extracted from the former Wiki executable test suite, but stay clear
/// of Wiki generation, CLI, MCP and HTTP-server responsibilities.
/// </summary>
internal static class FoundationPackageTests
{
    public static async Task RunAsync(Action<bool, string> assert)
    {
        await VerifyParserFallbackAsync(assert);
        await VerifyRepositoryBatchFallbackAsync(assert);
        await VerifyDeterministicEmbeddingsAsync(assert);
    }

    private static async Task VerifyParserFallbackAsync(Action<bool, string> assert)
    {
        var selector = ParserBackendSelector.CreateDefault(
            nativeProbeDirectories: ["/nonexistent-depa-wiki-native-parsers"],
            cliParser: new TreeSitterCliParser("/nonexistent-depa-wiki-tree-sitter"));
        var status = selector.DescribeStatus();

        assert(!status.NativeAvailable,
            "a missing native parser directory must report native parsing unavailable instead of throwing");
        assert(status.Diagnostics.Any(diagnostic => diagnostic.Code == "TSNAT001"),
            "native-parser fallback should expose the TSNAT001 diagnostic");
        assert(selector.SelectFor("csharp") is null,
            "when neither native nor CLI parsing is available, no C# backend should be selected");

        var cliStatus = await new TreeSitterCliParser("/nonexistent-depa-wiki-tree-sitter").GetStatusAsync();
        assert(!cliStatus.Available && cliStatus.Diagnostics.Any(diagnostic => diagnostic.Code == "TSCLI001"),
            "a missing tree-sitter executable should return structured TSCLI001 diagnostics");

        if (TreeSitterNativeBackend.TryCreate(out _) is { } native && native.SupportsLanguage("csharp"))
        {
            var parsed = native.Parse("Fixture.cs", "namespace Fixture; public sealed class Service { public void Run() { } }", "csharp");
            assert(parsed.Success && !parsed.HasErrors && parsed.Symbols.Any(symbol => symbol.Name == "Fixture"),
                "when bundled native parsers are present, C# source should produce a semantic symbol tree");
        }
    }

    private static async Task VerifyRepositoryBatchFallbackAsync(Action<bool, string> assert)
    {
        var root = Path.Combine(Path.GetTempPath(), "depa-wiki-indexing-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            await File.WriteAllTextAsync(Path.Combine(root, "Service.cs"), """
                namespace Fixture;

                public sealed class Service
                {
                    public void Execute() { }
                }
                """);
            await File.WriteAllTextAsync(Path.Combine(root, "README.md"), "# Fixture\n\nService execution guide.\n");

            var indexer = new RepositoryIndexer(ParserBackendSelector.CreateDefault(
                nativeProbeDirectories: ["/nonexistent-depa-wiki-native-parsers"],
                cliParser: new TreeSitterCliParser("/nonexistent-depa-wiki-tree-sitter")));
            var result = await indexer.BuildBatchAsync(new RepositoryIndexRequest(
                root,
                RepositoryId: "repo:foundation-test",
                RepositoryName: "foundation-test",
                UseGitIgnore: false,
                EnableRoslynEnhancement: false));
            var files = result.Batch.Files ?? [];
            var symbols = result.Batch.Symbols ?? [];

            assert(files.Any(file => file.Path == "Service.cs" && file.Language == "csharp"),
                "the indexer should retain C# source files when semantic parsers are unavailable");
            assert(files.Any(file => file.Path == "README.md" && file.Language == "markdown"),
                "the indexer should retain Markdown source files in the same batch");
            assert(symbols.Any(symbol => symbol.Name == "Service" && symbol.Resolver == "regex"),
                "unavailable parsers must degrade C# symbol extraction to the regex tier");
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    private static async Task VerifyDeterministicEmbeddingsAsync(Action<bool, string> assert)
    {
        var provider = new DeterministicEmbeddingProvider(dimensions: 8);
        var first = await provider.EmbedAsync("Service executes durable knowledge indexing");
        var second = await provider.EmbedAsync("Service executes durable knowledge indexing");
        var empty = await provider.EmbedAsync("");

        assert(first.Model == "deterministic-hash-v1" && first.Dimensions == 8 && first.Values.Count == 8,
            "deterministic embeddings should retain the requested dimensions and model identity");
        assert(first.Values.SequenceEqual(second.Values),
            "identical text must produce stable deterministic embeddings");
        assert(Math.Abs(Math.Sqrt(first.Values.Sum(value => value * value)) - 1.0) < 0.0001,
            "non-empty deterministic embeddings should be L2-normalized");
        assert(Math.Abs(Math.Sqrt(empty.Values.Sum(value => value * value)) - 1.0) < 0.0001,
            "empty deterministic embeddings should remain a normalized fallback vector");
    }
}
