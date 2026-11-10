<?php
/**
 * NeuroX JSON API (read-only, aggregated district figures).
 *
 *   GET api/index.php?action=all               full dataset used by the dashboard
 *   GET api/index.php?action=meta              settings and national figures
 *   GET api/index.php?action=districts         districts with coordinates
 *   GET api/index.php?action=district_2024     2024 figures (optional: district_id=)
 *   GET api/index.php?action=sources           sources and dates
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(array $body, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

/** Casts column values to PHP types so the JSON matches dataset.json. */
function cast_rows(array $rows, array $types): array
{
    foreach ($rows as &$row) {
        foreach ($types as $column => $type) {
            if (!array_key_exists($column, $row) || $row[$column] === null) {
                continue;
            }
            $row[$column] = match ($type) {
                'int' => (int) $row[$column],
                'float' => (float) $row[$column],
                'bool' => (bool) (int) $row[$column],
                default => (string) $row[$column],
            };
        }
    }
    unset($row);
    return $rows;
}

const DISTRICT_TYPES = ['id' => 'int', 'lat' => 'float', 'lon' => 'float'];

const DISTRICT_2024_TYPES = [
    'district_id' => 'int', 'population' => 'int', 'psych_clinic_visits' => 'int',
    'psychiatrists' => 'int', 'psych_beds' => 'int', 'mental_hospitalisations' => 'int',
    'psych_visits_per_100k' => 'float', 'psychiatrists_per_100k' => 'float', 'beds_per_100k' => 'float',
    'mh_hosp_per_100k' => 'float', 'visits_per_psychiatrist' => 'float', 'facilities_listed' => 'int',
    'service_use_score' => 'float',
];

const SOURCE_TYPES = ['is_synthetic' => 'bool'];

try {
    $config = require __DIR__ . '/config.php';

    $pdo = new PDO(
        sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $config['host'], $config['port'], $config['name']),
        $config['user'],
        $config['pass'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );

    $query = static function (string $sql) use ($pdo): array {
        return $pdo->query($sql)->fetchAll();
    };

    $metaRows = $query("SELECT setting_value FROM settings WHERE setting_key = 'meta'");
    $meta = $metaRows ? (json_decode($metaRows[0]['setting_value'], true) ?: []) : [];

    $districts = cast_rows(
        $query('SELECT id, name, province, lat, lon FROM districts ORDER BY id'),
        DISTRICT_TYPES
    );
    $district2024 = cast_rows(
        $query(
            'SELECT district_id, population, psych_clinic_visits, psychiatrists, psych_beds,
                    mental_hospitalisations, psych_visits_per_100k, psychiatrists_per_100k, beds_per_100k,
                    mh_hosp_per_100k, visits_per_psychiatrist, facilities_listed, service_use_score,
                    decision_key, decision_label, decision_reason
               FROM district_2024
              ORDER BY district_id'
        ),
        DISTRICT_2024_TYPES
    );
    $sources = cast_rows(
        $query('SELECT source_name, edition, file_name, downloaded_on, is_synthetic FROM source_files ORDER BY id'),
        SOURCE_TYPES
    );

    $onlyDistrict = filter_input(INPUT_GET, 'district_id', FILTER_VALIDATE_INT) ?: null;
    $filterDistrict = static function (array $rows) use ($onlyDistrict): array {
        if ($onlyDistrict === null) {
            return $rows;
        }
        return array_values(array_filter($rows, static fn(array $r): bool => $r['district_id'] === $onlyDistrict));
    };

    $action = $_GET['action'] ?? 'all';

    switch ($action) {
        case 'all':
            respond(['meta' => $meta, 'districts' => $districts, 'district_2024' => $district2024, 'sources' => $sources]);
            break;
        case 'meta':
            respond(['meta' => $meta]);
            break;
        case 'districts':
            respond(['districts' => $districts]);
            break;
        case 'district_2024':
            respond(['district_2024' => $filterDistrict($district2024)]);
            break;
        case 'sources':
            respond(['sources' => $sources]);
            break;
        default:
            respond(['error' => 'Unknown action.'], 400);
    }
} catch (Throwable $e) {
    error_log('NeuroX API: ' . $e->getMessage());
    respond(['error' => 'The database is unavailable. Check api/config.php and confirm the pipeline has been loaded.'], 500);
}
