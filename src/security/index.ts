import { SecurityModule, SecurityModuleResult } from './types';
import { ledgerIntegrityModule } from './ledgerIntegrity';
import { sessionEntropyModule } from './sessionEntropy';
import { hardwareSignatureModule } from './hardwareSignature';
import { networkShieldModule } from './networkShield';

export * from './types';
export { ledgerIntegrityModule } from './ledgerIntegrity';
export { sessionEntropyModule } from './sessionEntropy';
export { hardwareSignatureModule } from './hardwareSignature';
export { networkShieldModule } from './networkShield';

// Export the newly centralized server-side modules
export * from './passwordHashing';
export * from './sessionManagement';
export * from './rateLimiter';
export * from './inputSanitization';
export * from './auditLogger';
export * from './errorHandling';
export * from './permissionCheck';

// Built-in standard modules
const builtInModules: SecurityModule[] = [
  ledgerIntegrityModule,
  sessionEntropyModule,
  hardwareSignatureModule,
  networkShieldModule,
];

// In-memory runtime register for security modules
const moduleRegistry = new Map<string, SecurityModule>();

// Initialize registry with built-in modules
builtInModules.forEach(mod => {
  moduleRegistry.set(mod.id, { ...mod });
});

/**
 * Retrieves all registered security modules
 */
export function getSecurityModules(): SecurityModule[] {
  return Array.from(moduleRegistry.values());
}

/**
 * Register a new custom security module dynamically.
 * This makes it possible to write new modules and register them at runtime.
 */
export function registerSecurityModule(module: SecurityModule): void {
  moduleRegistry.set(module.id, { ...module });
}

/**
 * Unregister a security module from the system
 */
export function unregisterSecurityModule(id: string): boolean {
  return moduleRegistry.delete(id);
}

/**
 * Execute a specific security module by its registered ID
 */
export async function executeSecurityModule(id: string, context?: any): Promise<SecurityModuleResult> {
  const mod = moduleRegistry.get(id);
  if (!mod) {
    throw new Error(`Security module with ID "${id}" is not registered.`);
  }

  try {
    const result = await mod.execute(context);
    
    // Update last run timestamps and results in the registry state
    moduleRegistry.set(id, {
      ...mod,
      lastRun: result.timestamp,
      lastResult: result
    });

    return result;
  } catch (error: any) {
    const errorResult: SecurityModuleResult = {
      success: false,
      message: `System fault during module execution: ${error?.message || error}`,
      timestamp: new Date().toISOString()
    };

    moduleRegistry.set(id, {
      ...mod,
      lastRun: errorResult.timestamp,
      lastResult: errorResult
    });

    return errorResult;
  }
}

/**
 * Execute all active registered security modules sequentially
 */
export async function executeAllSecurityModules(context?: any): Promise<Record<string, SecurityModuleResult>> {
  const results: Record<string, SecurityModuleResult> = {};
  const modules = getSecurityModules();

  for (const mod of modules) {
    if (mod.status === 'active') {
      results[mod.id] = await executeSecurityModule(mod.id, context);
    }
  }

  return results;
}
