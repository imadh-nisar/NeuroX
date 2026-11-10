<?php
/**
 * NeuroX JSON API (read-only, aggregated data only).
 *
 *   GET api/index.php?action=all              full dataset used by the dashboard
 *   GET api/index.php?action=meta             settings: weights, thresholds, demo flag
 *   GET api/index.php?action=districts        districts with coordinates
 *   GET api/index.php?action=district_year    yearly indicators   (optional: district_id)
 *   GET api/index.php?action=age_sex          age and sex cells   (optional: district_id)
 *   GET api/index.php?action=alerts           rising-need alerts
 *
 * Suppressed age-sex cells have visits = null. Nothing else in this API identifies a person.
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

/**
 * Converts column values to PHP types so the JSON matches the dataset.json file.
 * DECIMAL columns come back from PDO as strings, so they are cast here.
 */
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

const DISTRICT_YEAR_TYPES = [
    'district_id' => 'int', 'year' => 'int', 'outpatient_visits' => 'int', 'admissions' => 'int',
    'referrals' => 'int', 'population' => 'int', 'unemployment_pct' => 'float', 'psychiatrists' => 'int',
    'completeness_pct' => 'float', 'out_rate' => 'float', 'adm_rate' => 'float', 'ref_rate' => 'float',
    'psych_per_100k' => 'float', 'visits_per_psychiatrist' => 'float', 'need_index' => 'float',
];

const AGE_SEX_TYPES = [
    'district_id' => 'int', 'year' => 'int', 'visits' => 'int', 'population' => 'int',
    'suppressed' => 'bool', 'rate_per_100k' => 'float',
];

const ALERT_TYPES = [
    'district_id' => 'int', 'first_year' => 'int', 'last_year' => 'int',
    'latest_index' => 'float', 'staffing_changed' => 'bool',
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

    $query = static function (string $sql, array $params = []) use ($pdo): array {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    };

    $metaRows = $query("SELECT setting_value FROM settings WHERE setting_key = 'meta'");
    $meta = $metaRows ? (json_decode($metaRows[0]['setting_value'], true) ?: []) : [];

    $districts = cast_rows(
        $query('SELECT id, name, province, lat, lon FROM districts ORDER BY id'),
        DISTRICT_TYPES
    );
    $districtYear = cast_rows(
        $query(
            'SELECT district_id, year, outpatient_visits, admissions, referrals, population,
                    unemployment_pct, psychiatrists, completeness_pct, out_rate, adm_rate, ref_rate,
                    psych_per_100k, visits_per_psychiatrist, need_index
               FROM district_year
              ORDER BY district_id, year'
        ),
        DISTRICT_YEAR_TYPES
    );
    $ageSex = cast_rows(
        $query(
            'SELECT district_id, year, age_group, sex, visits, population, suppressed, rate_per_100k
               FROM age_sex_year
              ORDER BY district_id, year, age_group, sex'
        ),
        AGE_SEX_TYPES
    );
    $alerts = cast_rows(
        $query(
            'SELECT district_id, first_year, last_year, latest_index, staffing_changed, message
               FROM alerts
              ORDER BY latest_index DESC'
        ),
        ALERT_TYPES
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
            respond([
                'meta' => $meta,
                'districts' => $districts,
                'district_year' => $districtYear,
                'age_sex' => $ageSex,
                'alerts' => $alerts,
                'sources' => $sources,
            ]);
            break;
        case 'meta':
            respond(['meta' => $meta]);
            break;
        case 'districts':
            respond(['districts' => $districts]);
            break;
        case 'district_year':
            respond(['district_year' => $filterDistrict($districtYear)]);
            break;
        case 'age_sex':
            respond(['age_sex' => $filterDistrict($ageSex)]);
            break;
        case 'alerts':
            respond(['alerts' => $alerts]);
            break;
        default:
            respond(['error' => 'Unknown action.'], 400);
    }
} catch (Throwable $e) {
    error_log('NeuroX API: ' . $e->getMessage());
    respond(['error' => 'The database is unavailable. Check api/config.php and confirm the pipeline has been loaded.'], 500);
}
