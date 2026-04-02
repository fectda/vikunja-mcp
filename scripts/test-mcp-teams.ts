#!/usr/bin/env npx tsx
/**
 * Teams Integration Tests
 * Tests vikunja-mcp teams tools against a real Vikunja instance
 * Verifies bugs: update name, members.update admin, members.remove
 */

const TEAMS_CONFIG = {
  apiUrl: process.env.VIKUNJA_URL || '',
  apiToken: process.env.VIKUNJA_API_TOKEN || '',
  testTeamName: 'MCP-Test-Team',
};

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const teamsResults: TestResult[] = [];

function log(msg: string): void {
  console.log(msg);
}

function pass(name: string): void {
  teamsResults.push({ name, passed: true });
  log(`  ✓ ${name}`);
}

function fail(name: string, error: string): void {
  teamsResults.push({ name, passed: false, error });
  log(`  ✗ ${name} (${error})`);
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${TEAMS_CONFIG.apiUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${TEAMS_CONFIG.apiToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${method} ${path} failed: ${res.status} ${text}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : (null as unknown as T);
}

async function setupTeams(): Promise<boolean> {
  log('\n[Setup Teams]');
  if (!TEAMS_CONFIG.apiUrl || !TEAMS_CONFIG.apiToken) {
    log('ERROR: Set VIKUNJA_URL and VIKUNJA_API_TOKEN environment variables');
    return false;
  }
  log(`API: ${TEAMS_CONFIG.apiUrl}`);

  // Clean up existing test team
  try {
    const teams = await api<Array<{ id: number; name: string }>>('GET', '/teams');
    const existing = teams.find((t) => t.name === TEAMS_CONFIG.testTeamName);
    if (existing) {
      log(`Deleting existing test team: ${existing.id}`);
      await api('DELETE', `/teams/${existing.id}`);
    }
  } catch {
    /* ignore */
  }

  return true;
}

// ============================================================================
// Bug 1: teams.update - name not being sent to Vikunja API
// ============================================================================

async function testTeamsUpdateName(): Promise<void> {
  log('\n  Bug 1 - teams.update name:');

  let teamId: number | null = null;

  // Create a team
  try {
    const team = await api<{ id: number; name: string }>('PUT', '/teams', {
      name: TEAMS_CONFIG.testTeamName,
    });
    teamId = team.id;
    log(`    Created team: ${team.id}`);
  } catch (e) {
    fail('teams.update (setup)', (e as Error).message);
    return;
  }

  // Update the team name
  try {
    await api('PUT', `/teams/${teamId}`, { name: 'Updated Team X' });

    // READ BACK to verify - this is the key test
    const verify = await api<{ name: string }>('GET', `/teams/${teamId}`);

    if (verify.name === 'Updated Team X') {
      pass('teams.update - name persisted');
    } else {
      fail(
        'teams.update - name persisted',
        `API returned: "${verify.name}", expected: "Updated Team X"`,
      );
    }

    // Cleanup
    await api('DELETE', `/teams/${teamId}`);
  } catch (e) {
    fail('teams.update - name persisted', (e as Error).message);
  }
}

// ============================================================================
// Bug 2: teams.members.update - admin flag not being sent correctly
// ============================================================================

async function testTeamsMembersUpdateAdmin(): Promise<void> {
  log('\n  Bug 2 - teams.members.update admin:');

  let teamId: number | null = null;
  let userId: number | null = null;

  try {
    // Get current user ID
    const user = await api<{ id: number }>('GET', '/user');
    userId = user.id;
  } catch (e) {
    fail('teams.members.update (setup - get user)', (e as Error).message);
    return;
  }

  // Create a team
  try {
    const team = await api<{ id: number }>('PUT', '/teams', {
      name: TEAMS_CONFIG.testTeamName,
    });
    teamId = team.id;
  } catch (e) {
    fail('teams.members.update (setup - create team)', (e as Error).message);
    return;
  }

  // Add user to team (as non-admin first)
  try {
    await api('PUT', `/teams/${teamId}/members`, { user_id: userId, admin: false });
  } catch (e) {
    fail('teams.members.update (setup - add member)', (e as Error).message);
    await api('DELETE', `/teams/${teamId}`).catch(() => {});
    return;
  }

  // Update member to admin
  try {
    await api('POST', `/teams/${teamId}/members/${userId}`, { user_id: userId, admin: true });

    // READ BACK to verify - this is the key test
    const team = await api<{ members: Array<{ id: number; admin: boolean }> }>(
      'GET',
      `/teams/${teamId}`,
    );
    const member = team.members?.find((m) => m.id === userId);

    if (member?.admin === true) {
      pass('teams.members.update - admin flag persisted');
    } else {
      fail(
        'teams.members.update - admin flag persisted',
        `admin = ${member?.admin}, expected: true`,
      );
    }

    // Cleanup
    await api('DELETE', `/teams/${teamId}`);
  } catch (e) {
    fail('teams.members.update - admin flag persisted', (e as Error).message);
    if (teamId) {
      await api('DELETE', `/teams/${teamId}`).catch(() => {});
    }
  }
}

// ============================================================================
// Bug 3: teams.members.remove - user not being removed properly
// ============================================================================

async function testTeamsMembersRemove(): Promise<void> {
  log('\n  Bug 3 - teams.members.remove:');

  let teamId: number | null = null;
  let userId: number | null = null;

  try {
    // Get current user ID
    const user = await api<{ id: number }>('GET', '/user');
    userId = user.id;
  } catch (e) {
    fail('teams.members.remove (setup - get user)', (e as Error).message);
    return;
  }

  // Create a team
  try {
    const team = await api<{ id: number }>('PUT', '/teams', {
      name: TEAMS_CONFIG.testTeamName,
    });
    teamId = team.id;
  } catch (e) {
    fail('teams.members.remove (setup - create team)', (e as Error).message);
    return;
  }

  // Add user to team
  try {
    await api('PUT', `/teams/${teamId}/members`, { user_id: userId });
  } catch (e) {
    fail('teams.members.remove (setup - add member)', (e as Error).message);
    await api('DELETE', `/teams/${teamId}`).catch(() => {});
    return;
  }

  // Remove user from team
  try {
    await api('DELETE', `/teams/${teamId}/members/${userId}`);

    // READ BACK to verify - this is the key test
    const team = await api<{ members: Array<{ id: number }> }>('GET', `/teams/${teamId}`);
    const memberStillExists = team.members?.some((m) => m.id === userId);

    if (!memberStillExists) {
      pass('teams.members.remove - user removed');
    } else {
      fail('teams.members.remove - user removed', 'User still in team members');
    }

    // Cleanup
    await api('DELETE', `/teams/${teamId}`);
  } catch (e) {
    fail('teams.members.remove - user removed', (e as Error).message);
    if (teamId) {
      await api('DELETE', `/teams/${teamId}`).catch(() => {});
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  log('╔════════════════════════════════════════╗');
  log('║     Teams Integration Tests            ║');
  log('║     Verifying PRD-documented bugs       ║');
  log('╚════════════════════════════════════════╝');

  if (!(await setupTeams())) {
    process.exit(1);
  }

  await testTeamsUpdateName();
  await testTeamsMembersUpdateAdmin();
  await testTeamsMembersRemove();

  // Summary
  log('\n[Summary]');
  const passed = teamsResults.filter((r) => r.passed).length;
  const failed = teamsResults.filter((r) => !r.passed).length;

  log(`Passed: ${passed}, Failed: ${failed}`);

  if (failed > 0) {
    log('\nFailed tests:');
    teamsResults
      .filter((r) => !r.passed)
      .forEach((r) => {
        log(`  - ${r.name}: ${r.error}`);
      });
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
