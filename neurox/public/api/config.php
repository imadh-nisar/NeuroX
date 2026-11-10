<?php
/**
 * Database settings for the NeuroX API.
 *
 * Set these as environment variables in production. Use a read-only database user.
 * In production, keep this file outside the web root.
 */
return [
    'host' => getenv('NEUROX_DB_HOST') ?: 'localhost',
    'port' => (int) (getenv('NEUROX_DB_PORT') ?: 3306),
    'name' => getenv('NEUROX_DB_NAME') ?: 'neurox',
    'user' => getenv('NEUROX_DB_USER') ?: 'neurox',
    'pass' => getenv('NEUROX_DB_PASS') ?: '',
];
