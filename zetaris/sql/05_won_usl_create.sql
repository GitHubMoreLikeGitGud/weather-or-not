-- =============================================================================
-- USL weather_or_not_usl in lightning.metastore.weatherornot: five tables with
-- primary and foreign keys, a description on the model, every table and every
-- column, two activations from the GHCN views (station, weather_quarter) and
-- the custom DQ rule coverage_ok.
--
-- Prerequisites: 04_won_ghcn_create.sql (the cached won.ghcn_<year>_<element>
-- views). The SEC lane activates utility, sic_code and revenue_quarter from its
-- views (01_won_sec_*.sql, 02_won_dns_*.sql); their activation shapes are at the
-- end of this file, commented out until those views exist on the instance.
--
-- Rules: one statement per call. The COMPILE USL statement is sent as ONE
-- statement (the runner merges the CREATE TABLE parts back into it). Description
-- text is unquoted (a quoted string is stored with its quotes) and never contains
-- a semicolon or an apostrophe.
--
-- Status: verified live on Zetaris 2.4.3.1 (2026-10-24); outcomes, counts and DQ
-- timings in ../README.md.
--
-- Caveats:
--   1. weather_quarter and revenue_quarter declare composite primary keys (SPEC
--      section 4 G6) as table-level PRIMARY KEY (...); Zetaris 2.4.3.1 accepted
--      them. The first COMPILE attempt failed with "Invalid DDL statement" because
--      the revenue column was named tag: tag is a reserved word in the Lightning
--      catalog parser (an UPDATE USL on revenue_quarter.tag fails with "no viable
--      alternative at input"), so the column is xbrl_tag.
--   2. station is activated from the DISTINCT ids of the cached 2025 TMAX view,
--      joined to an inline VALUES list of (id, state, name) from seeds/stations.json
--      plus USW00013740 (the validation station). A station with GHCN data but no
--      seed entry would have NULL state and name.
--   3. weather_quarter holds Q1 to Q3 of 2024 and 2025 for every station in the
--      views: the method never uses Q4 (SPEC section 0). Days with a quality flag
--      on TMAX or TMIN are dropped before the join.
--   4. A re-run of ACTIVATE with a changed query re-binds the table and keeps the
--      DQ rules (ClearShelf Day-0 probe); REGISTER DQ fails if the rule exists.
-- =============================================================================

-- Step 0: namespaces. The parent must exist before the child.
CREATE NAMESPACE IF NOT EXISTS lightning.metastore;
CREATE NAMESPACE IF NOT EXISTS lightning.metastore.weatherornot;

-- Step 1: the model, five tables, ONE statement.
COMPILE USL IF NOT EXISTS weather_or_not_usl DEPLOY NAMESPACE lightning.metastore.weatherornot DDL
CREATE TABLE sic_code (
    code varchar(4) NOT NULL PRIMARY KEY,
    description varchar(200)
);
CREATE TABLE utility (
    cik varchar(10) NOT NULL PRIMARY KEY,
    name varchar(200),
    ticker varchar(10),
    sic varchar(4) FOREIGN KEY REFERENCES sic_code(code),
    hq_state varchar(2)
);
CREATE TABLE station (
    id varchar(11) NOT NULL PRIMARY KEY,
    state varchar(2),
    name varchar(60)
);
CREATE TABLE weather_quarter (
    station_id varchar(11) NOT NULL FOREIGN KEY REFERENCES station(id),
    year int NOT NULL,
    quarter int NOT NULL,
    hdd double,
    cdd double,
    days_observed int,
    coverage double,
    PRIMARY KEY (station_id, year, quarter)
);
CREATE TABLE revenue_quarter (
    cik varchar(10) NOT NULL FOREIGN KEY REFERENCES utility(cik),
    xbrl_tag varchar(60) NOT NULL,
    year int NOT NULL,
    quarter int NOT NULL,
    val double,
    accn varchar(25) NOT NULL,
    filed varchar(10),
    is_comparative boolean,
    PRIMARY KEY (cik, xbrl_tag, year, quarter, accn)
);

-- Step 2: descriptions (the planner prompt is built from LOAD USL output).
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl SET DESCRIPTION Weather-or-Not model - US electric utilities from SEC EDGAR, their SIC codes, GHCN airport weather stations, heating and cooling degree days per station and quarter computed in Lightning SQL, and quarterly revenue facts with the filing that reported them. Used to split a revenue change into weather, industry and company-specific parts.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.sic_code SET TABLE DESCRIPTION SIC code reference from company_dns. Electric utilities are 4911, 4931 and 4932.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.sic_code.code SET COLUMN DESCRIPTION Four-digit SIC code, zero padded.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.sic_code.description SET COLUMN DESCRIPTION SIC industry description.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.utility SET TABLE DESCRIPTION One row per SEC filer in the utility seed list, from the EDGAR submissions endpoint. hq_state is the business address state, not the service territory.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.utility.cik SET COLUMN DESCRIPTION SEC Central Index Key as a zero padded 10-digit string.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.utility.name SET COLUMN DESCRIPTION Filer name as EDGAR reports it.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.utility.ticker SET COLUMN DESCRIPTION Primary ticker symbol, may be empty.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.utility.sic SET COLUMN DESCRIPTION SIC code from the submissions endpoint, foreign key to sic_code.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.utility.hq_state SET COLUMN DESCRIPTION Business address state, two letters.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.station SET TABLE DESCRIPTION GHCN-Daily first-order airport stations used as the weather proxy for a state, one or two per state, with the validation station USW00013740.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.station.id SET COLUMN DESCRIPTION GHCN station id, 11 characters, USW prefix.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.station.state SET COLUMN DESCRIPTION US state the station stands for, two letters.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.station.name SET COLUMN DESCRIPTION Station name from the GHCN station inventory.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.weather_quarter SET TABLE DESCRIPTION Degree days per station and calendar quarter, Q1 to Q3 of 2024 and 2025, computed in Lightning SQL from the cached GHCN TMAX and TMIN views. Tmean F is the mean of TMAX and TMIN converted from tenths of a degree C. Days with a quality flag are dropped.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.weather_quarter.station_id SET COLUMN DESCRIPTION GHCN station id, foreign key to station.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.weather_quarter.year SET COLUMN DESCRIPTION Calendar year of the quarter.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.weather_quarter.quarter SET COLUMN DESCRIPTION Calendar quarter 1 to 3 from the month of the observation date.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.weather_quarter.hdd SET COLUMN DESCRIPTION Heating degree days, sum over observed days of max of 0 and 65 minus Tmean F.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.weather_quarter.cdd SET COLUMN DESCRIPTION Cooling degree days, sum over observed days of max of 0 and Tmean F minus 65.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.weather_quarter.days_observed SET COLUMN DESCRIPTION Days in the quarter with both TMAX and TMIN and no quality flag.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.weather_quarter.coverage SET COLUMN DESCRIPTION days_observed divided by the days in the quarter, 0 to 1. The DQ rule coverage_ok requires at least 0.9.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.revenue_quarter SET TABLE DESCRIPTION Quarterly revenue facts per filer and tag from SEC frames and companyconcept, one row per filing that reported the period. is_comparative marks a value taken from the comparative column of a later filing, which rule R1 prefers over the original.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.revenue_quarter.cik SET COLUMN DESCRIPTION SEC CIK, zero padded 10 digits, foreign key to utility.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.revenue_quarter.xbrl_tag SET COLUMN DESCRIPTION XBRL us-gaap tag, Revenues or RevenueFromContractWithCustomerExcludingAssessedTax or RegulatedAndUnregulatedOperatingRevenue.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.revenue_quarter.year SET COLUMN DESCRIPTION Calendar year of the period.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.revenue_quarter.quarter SET COLUMN DESCRIPTION Calendar quarter 1 to 3, or 0 for a full fiscal year.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.revenue_quarter.val SET COLUMN DESCRIPTION Reported value in US dollars.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.revenue_quarter.accn SET COLUMN DESCRIPTION Accession number of the filing that reported the value.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.revenue_quarter.filed SET COLUMN DESCRIPTION Filing date yyyy-mm-dd.;
UPDATE USL lightning.metastore.weatherornot.weather_or_not_usl.revenue_quarter.is_comparative SET COLUMN DESCRIPTION True when the value is the comparative column of a later filing rather than the original report.;

-- Step 3: activate station from the cached 2025 TMAX view (DISTINCT ids), with
-- state and name from the seed list (caveat 2).
ACTIVATE USL TABLE lightning.metastore.weatherornot.weather_or_not_usl.station AS
SELECT COALESCE(v.ID, '') AS id, s.state AS state, s.name AS name
FROM (SELECT DISTINCT ID FROM won.ghcn_2025_tmax) v
LEFT JOIN (
  SELECT id, state, name FROM VALUES
    ('USW00003017', 'CO', 'DENVER INTL AP'),
    ('USW00003927', 'TX', 'DAL-FTW WSCMO AP'),
    ('USW00003940', 'MS', 'JACKSON INTL AP'),
    ('USW00012839', 'FL', 'MIAMI INTL AP'),
    ('USW00012842', 'FL', 'TAMPA INTL AP'),
    ('USW00012916', 'LA', 'NEW ORLEANS AP'),
    ('USW00012960', 'TX', 'HOUSTON INTERCONTINENTAL AP'),
    ('USW00013722', 'NC', 'RALEIGH AP'),
    ('USW00013737', 'VA', 'NORFOLK INTL AP'),
    ('USW00013739', 'PA', 'PHILA INTL AP'),
    ('USW00013740', 'VA', 'RICHMOND INTL AP'),
    ('USW00013781', 'DE', 'WILMINGTON NEW CASTLE CO AP'),
    ('USW00013866', 'WV', 'CHARLESTON - YEAGER AP'),
    ('USW00013874', 'GA', 'ATLANTA HARTSFIELD-JACKSON INT'),
    ('USW00013876', 'AL', 'BIRMINGHAM AP'),
    ('USW00013883', 'SC', 'COLUMBIA'),
    ('USW00013963', 'AR', 'LITTLE ROCK AP ADAMS FLD'),
    ('USW00013967', 'OK', 'OKLAHOMA CY WILL ROGERS WORLD'),
    ('USW00013994', 'MO', 'ST LOUIS LAMBERT INTL AP'),
    ('USW00013996', 'KS', 'TOPEKA ASOS'),
    ('USW00014734', 'NJ', 'NEWARK LIBERTY INTL AP'),
    ('USW00014739', 'MA', 'BOSTON'),
    ('USW00014740', 'CT', 'HARTFORD-BRADLEY INTL AP'),
    ('USW00014745', 'NH', 'CONCORD ASOS'),
    ('USW00014765', 'RI', 'PROVIDENCE'),
    ('USW00014820', 'OH', 'CLEVELAND'),
    ('USW00014821', 'OH', 'JOHN GLENN INTL AP'),
    ('USW00014836', 'MI', 'LANSING CAPITAL CITY AP'),
    ('USW00014837', 'WI', 'MADISON DANE CO RGNL AP'),
    ('USW00014839', 'WI', 'MILWAUKEE MITCHELL AP'),
    ('USW00014842', 'IL', 'GENERAL WAYNE A DOWNING INTL A'),
    ('USW00014913', 'MN', 'DULUTH'),
    ('USW00014922', 'MN', 'MINNEAPOLIS-ST PAUL INTL AP'),
    ('USW00014933', 'IA', 'DES MOINES INTL AP'),
    ('USW00014944', 'SD', 'SIOUX FALLS'),
    ('USW00022521', 'HI', 'HONOLULU INTL AP'),
    ('USW00023050', 'NM', 'ALBUQUERQUE INTL AP'),
    ('USW00023174', 'CA', 'LOS ANGELES INTL AP'),
    ('USW00023183', 'AZ', 'PHOENIX AP'),
    ('USW00023234', 'CA', 'SAN FRANCISCO INTL AP'),
    ('USW00024011', 'ND', 'BISMARCK'),
    ('USW00024018', 'WY', 'CHEYENNE'),
    ('USW00024033', 'MT', 'BILLINGS INTL AP'),
    ('USW00024090', 'SD', 'RAPID CITY RGNL AP'),
    ('USW00024131', 'ID', 'BOISE AIR TERMINAL'),
    ('USW00024229', 'OR', 'PORTLAND INTL AP'),
    ('USW00024233', 'WA', 'SEATTLE TACOMA AP'),
    ('USW00093720', 'MD', 'SALISBURY-WICOMICO RGNL AP'),
    ('USW00093721', 'MD', 'BALTIMORE-WASHINGTON INTL AP'),
    ('USW00093730', 'NJ', 'ATLANTIC CITY INTL AP'),
    ('USW00093817', 'IN', 'EVANSVILLE RGNL AP'),
    ('USW00093819', 'IN', 'INDIANAPOLIS'),
    ('USW00093821', 'KY', 'LOUISVILLE INTL AP'),
    ('USW00094728', 'NY', 'NY CITY CNTRL PARK'),
    ('USW00094823', 'PA', 'PITTSBURGH ASOS'),
    ('USW00094846', 'IL', 'CHICAGO OHARE INTL AP'),
    ('USW00094847', 'MI', 'DETROIT METRO AP')
  AS seed(id, state, name)
) s ON s.id = v.ID;

-- Step 4: activate weather_quarter from the four cached views: per station, year
-- and quarter (Q1 to Q3), the same arithmetic as the gateway's weather_quarter
-- template. Days in the quarter: Q1 90 (91 in a leap year), Q2 91, Q3 92.
-- The sum of the two readings is cast to DOUBLE first: bigint / 2.0 is a DECIMAL
-- in Spark, and a DECIMAL behind a column declared double breaks aggregates over
-- the USL table ("java.math.BigDecimal is not a valid external type for schema
-- of double", seen live with AVG(hdd + cdd)); projections do not show it.
ACTIVATE USL TABLE lightning.metastore.weatherornot.weather_or_not_usl.weather_quarter AS
SELECT COALESCE(d.station_id, '') AS station_id,
       COALESCE(d.year, 0) AS year,
       COALESCE(d.quarter, 0) AS quarter,
       CAST(SUM(GREATEST(0, 65 - d.tmean_f)) AS DOUBLE) AS hdd,
       CAST(SUM(GREATEST(0, d.tmean_f - 65)) AS DOUBLE) AS cdd,
       CAST(COUNT(*) AS INT) AS days_observed,
       COUNT(*) / CAST(CASE d.quarter WHEN 1 THEN CASE WHEN d.year % 4 = 0 THEN 91 ELSE 90 END WHEN 2 THEN 91 ELSE 92 END AS DOUBLE) AS coverage
FROM (
  SELECT x.ID AS station_id, 2025 AS year,
         CAST((CAST(substr(x.DATE, 5, 2) AS INT) - 1) / 3 AS INT) + 1 AS quarter,
         (CAST(x.DATA_VALUE + n.DATA_VALUE AS DOUBLE) / 2.0) / 10.0 * 9.0 / 5.0 + 32 AS tmean_f
  FROM won.ghcn_2025_tmax x
  JOIN won.ghcn_2025_tmin n ON n.ID = x.ID AND n.DATE = x.DATE
  WHERE (x.Q_FLAG IS NULL OR x.Q_FLAG = '') AND (n.Q_FLAG IS NULL OR n.Q_FLAG = '')
  UNION ALL
  SELECT x.ID AS station_id, 2024 AS year,
         CAST((CAST(substr(x.DATE, 5, 2) AS INT) - 1) / 3 AS INT) + 1 AS quarter,
         (CAST(x.DATA_VALUE + n.DATA_VALUE AS DOUBLE) / 2.0) / 10.0 * 9.0 / 5.0 + 32 AS tmean_f
  FROM won.ghcn_2024_tmax x
  JOIN won.ghcn_2024_tmin n ON n.ID = x.ID AND n.DATE = x.DATE
  WHERE (x.Q_FLAG IS NULL OR x.Q_FLAG = '') AND (n.Q_FLAG IS NULL OR n.Q_FLAG = '')
) d
WHERE d.quarter <= 3
GROUP BY d.station_id, d.year, d.quarter;

-- Step 5: the custom DQ rule. The primary and foreign keys generate their own
-- rules (named after the columns; see LIST DQ USL in 05_won_usl_select.sql).
REGISTER DQ coverage_ok TABLE lightning.metastore.weatherornot.weather_or_not_usl.weather_quarter AS coverage >= 0.9;

-- =============================================================================
-- SEC lane: activations of sic_code, utility and revenue_quarter from the SEC
-- views, in this order (parents first). Shapes only; the SEC lane runs them once
-- won.sic_codes, won.submission_<cik10>, won.frames_<tag>_<period> and
-- won.concept_<cik10>_<tag> exist. Every NOT NULL column needs COALESCE.
-- =============================================================================
-- ACTIVATE USL TABLE lightning.metastore.weatherornot.weather_or_not_usl.sic_code AS
-- SELECT COALESCE(code, '') AS code, description FROM won.sic_codes;
--
-- ACTIVATE USL TABLE lightning.metastore.weatherornot.weather_or_not_usl.utility AS
-- SELECT COALESCE(cik, '') AS cik, name, CAST(NULL AS STRING) AS ticker, sic, state AS hq_state FROM won.submission_0001326160
-- UNION ALL
-- SELECT COALESCE(cik, '') AS cik, name, CAST(NULL AS STRING) AS ticker, sic, state AS hq_state FROM won.submission_0000092122;
--
-- ACTIVATE USL TABLE lightning.metastore.weatherornot.weather_or_not_usl.revenue_quarter AS
-- SELECT COALESCE(LPAD(CAST(cik AS STRING), 10, '0'), '') AS cik, 'Revenues' AS xbrl_tag, 2025 AS year, 1 AS quarter,
--        CAST(val AS DOUBLE) AS val, COALESCE(accn, '') AS accn, CAST(NULL AS STRING) AS filed, false AS is_comparative
-- FROM won.frames_Revenues_CY2025Q1;
