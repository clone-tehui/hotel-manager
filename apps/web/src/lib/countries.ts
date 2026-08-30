const PRIORITY_CODES = ['VN', 'KR', 'CN'] as const;

const COUNTRY_CODES = [
  'AF','AX','AL','DZ','AS','AD','AO','AI','AQ','AG','AR','AM','AW','AU','AT','AZ',
  'BS','BH','BD','BB','BY','BE','BZ','BJ','BM','BT','BO','BQ','BA','BW','BV','BR','IO','BN','BG','BF','BI',
  'CV','KH','CM','CA','KY','CF','TD','CL','CN','CX','CC','CO','KM','CG','CD','CK','CR','CI','HR','CU','CW','CY','CZ',
  'DK','DJ','DM','DO',
  'EC','EG','SV','GQ','ER','EE','SZ','ET',
  'FK','FO','FJ','FI','FR','GF','PF','TF',
  'GA','GM','GE','DE','GH','GI','GR','GL','GD','GP','GU','GT','GG','GN','GW','GY',
  'HT','HM','VA','HN','HK','HU',
  'IS','IN','ID','IR','IQ','IE','IM','IL','IT',
  'JM','JP','JE','JO',
  'KZ','KE','KI','KP','KR','KW','KG',
  'LA','LV','LB','LS','LR','LY','LI','LT','LU',
  'MO','MG','MW','MY','MV','ML','MT','MH','MQ','MR','MU','YT','MX','FM','MD','MC','MN','ME','MS','MA','MZ','MM',
  'NA','NR','NP','NL','NC','NZ','NI','NE','NG','NU','NF','MK','MP','NO',
  'OM',
  'PK','PW','PS','PA','PG','PY','PE','PH','PN','PL','PT','PR',
  'QA',
  'RE','RO','RU','RW',
  'BL','SH','KN','LC','MF','PM','VC','WS','SM','ST','SA','SN','RS','SC','SL','SG','SX','SK','SI','SB','SO','ZA','GS','SS','ES','LK','SD','SR','SJ','SE','CH','SY',
  'TW','TJ','TZ','TH','TL','TG','TK','TO','TT','TN','TR','TM','TC','TV',
  'UG','UA','AE','GB','UM','US','UY','UZ',
  'VU','VE','VN','VG','VI',
  'WF','EH',
  'YE',
  'ZM','ZW'
] as const;

export interface CountryOption {
  code: string;
  label: string;
  flag: string;
  searchText: string;
}

function codeToFlag(code: string) {
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function buildCountryLabel(code: string) {
  const viNames = new Intl.DisplayNames(['vi'], { type: 'region' });
  const enNames = new Intl.DisplayNames(['en'], { type: 'region' });
  return viNames.of(code) || enNames.of(code) || code;
}

const prioritized = new Set(PRIORITY_CODES);

const baseCountries = COUNTRY_CODES.map((code) => {
  const label = buildCountryLabel(code);
  return {
    code,
    label,
    flag: codeToFlag(code),
    searchText: `${code} ${label}`.toLowerCase(),
  } satisfies CountryOption;
});

const priorityCountries = PRIORITY_CODES
  .map((code) => baseCountries.find((country) => country.code === code))
  .filter(Boolean) as CountryOption[];

const otherCountries = baseCountries
  .filter((country) => !prioritized.has(country.code as typeof PRIORITY_CODES[number]))
  .sort((a, b) => a.label.localeCompare(b.label, 'vi'));

export const COUNTRY_OPTIONS: CountryOption[] = [...priorityCountries, ...otherCountries];
