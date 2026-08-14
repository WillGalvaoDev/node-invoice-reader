export async function persistAuditBestEffort({ repository, logger, log, requestId }) {
    try {
        await repository.create(log);
    }
    catch (error) {
        logger.error('Failed to persist audit log', {
            ...(requestId && { requestId }),
            action: log.action,
            entity: log.entity,
            error: { name: error instanceof Error ? error.name : 'UnknownError' },
        });
    }
}
//# sourceMappingURL=best-effort-audit.js.map