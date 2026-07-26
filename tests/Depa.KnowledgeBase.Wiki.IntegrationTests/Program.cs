namespace Depa.KnowledgeBase.Wiki.IntegrationTests;

internal static class Program
{
    private static async Task<int> Main()
    {
        var failures = new List<string>();
        void Assert(bool condition, string message)
        {
            if (!condition)
            {
                failures.Add(message);
            }
        }

        RoslynEnhancerTests.Run(Assert);
        await FoundationPackageTests.RunAsync(Assert);

        if (failures.Count == 0)
        {
            Console.WriteLine("Depa.KnowledgeBase.Wiki foundation tests passed.");
            return 0;
        }

        foreach (var failure in failures)
        {
            Console.Error.WriteLine("FAIL: " + failure);
        }

        return 1;
    }
}
