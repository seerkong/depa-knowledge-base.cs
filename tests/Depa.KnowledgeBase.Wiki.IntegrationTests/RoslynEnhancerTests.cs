namespace Depa.KnowledgeBase.Wiki.IntegrationTests;

using Depa.KnowledgeBase.Wiki.Roslyn;
using RoslynEnhancer = Depa.KnowledgeBase.Wiki.Roslyn.RoslynEnhancer;

/// <summary>
/// Fixed-sample coverage migrated from the former Wiki test suite. It verifies semantic
/// resolution, candidate degradation, external-call accounting and Roslyn symbol identity.
/// </summary>
internal static class RoslynEnhancerTests
{
    private const string AlphaSource = """
        namespace Fixture.App;

        public class Alpha
        {
            public void Run()
            {
                var beta = new Beta();
                Beta other = new();
                beta.Ping();
                other.Ping(42);
                Console.WriteLine("hello");
                var name = nameof(Beta);
                Ambiguous(1, 2);
            }

            public string Tag => Helper();

            private static string Helper() => "tag";

            private static void Ambiguous(int a, double b) { }

            private static void Ambiguous(double a, int b) { }
        }
        """;

    private const string BetaSource = """
        namespace Fixture.App;

        public class Beta
        {
            public void Ping()
            {
            }

            public void Ping(int value)
            {
            }
        }
        """;

    private const string MainSource = """
        using Fixture.App;

        var alpha = new Alpha();
        alpha.Run();
        """;

    public static void Run(Action<bool, string> assert)
    {
        var result = RoslynEnhancer.Analyze(
        [
            ("src/Alpha.cs", AlphaSource),
            ("src/Beta.cs", BetaSource),
            ("src/Main.cs", MainSource),
        ]);

        var edges = result.Edges;
        const string alphaRun = "M:Fixture.App.Alpha.Run";
        assert(edges.Any(edge => edge.CallerDocId == alphaRun && edge.CalleeDocId == "M:Fixture.App.Beta.#ctor"
            && edge.Confidence == 1.0 && edge.Evidence == "semantic" && edge.File == "src/Alpha.cs" && edge.Line == 7),
            "explicit object creation should create a semantic in-source constructor edge");
        assert(edges.Any(edge => edge.CallerDocId == alphaRun && edge.CalleeDocId == "M:Fixture.App.Beta.Ping(System.Int32)"
            && edge.Confidence == 1.0 && edge.Line == 10),
            "overload resolution should use the exact integer Ping overload");
        assert(!edges.Any(edge => edge.File == "src/Alpha.cs" && edge.Line == 11) && result.ExternalCalls == 1,
            "BCL calls should be counted as external rather than emitted as in-repository edges");
        assert(!edges.Any(edge => edge.File == "src/Alpha.cs" && edge.Line == 12) && result.UnknownCalls == 0,
            "nameof expressions should not be treated as calls");

        var candidate = edges.Single(edge => edge.File == "src/Alpha.cs" && edge.Line == 13);
        assert(candidate.Confidence == 0.6 && candidate.Evidence.Contains("OverloadResolutionFailure", StringComparison.Ordinal),
            "ambiguous overloads should degrade to a candidate edge with the compiler reason");
        assert(edges.Any(edge => edge.CallerDocId == "M:Fixture.App.Alpha.get_Tag"
            && edge.CalleeDocId == "M:Fixture.App.Alpha.Helper"),
            "calls in expression-bodied properties should be attributed to the getter");

        var mainEdges = edges.Where(edge => edge.File == "src/Main.cs").ToArray();
        assert(mainEdges.Length == 2 && mainEdges.All(edge => edge.CallerDocId.Contains("Main", StringComparison.Ordinal)),
            "top-level statements should share the synthesized entry-point caller identity");

        var beta = result.Symbols.Single(symbol => symbol.DocId == "T:Fixture.App.Beta");
        assert(beta.SymKey == "csharp:Fixture.App.Beta#0" && beta.StartLine == 3 && beta.EndLine == 12,
            "type symbols should retain the stable csharp sym_key and 1-based span");
        var ping = result.Symbols.Single(symbol => symbol.DocId == "M:Fixture.App.Beta.Ping(System.Int32)");
        assert(ping.SymKey == "csharp:Fixture.App.Beta.Ping#1" && ping.Arity == 1,
            "method sym_keys should retain parameter arity");
    }
}
