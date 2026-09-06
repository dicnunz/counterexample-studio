# Isolated Heesch official-baseline verification

This research branch runs the unmodified public Layr-Labs/heesch benchmark at commit ce3b8d6974d3f318c3c6081b421ed51c7d041d6e against its existing public incumbent. It is not a new candidate or a Yukon submission. The repository's default branch and application are unchanged.

The workflow uses a standard public Ubuntu runner, no secrets, no deployments, no artifact/cache uploads, and no paid services. Raw checker output and score.json are printed to the workflow log. Successful execution is not assumed: inspect the run and the explicit final success marker.
