import { Arrays, Strings, Types } from 'cafe-utility';
import { writeFileSync } from 'fs';
import { exit } from 'process';
import { getRows } from './Database';

generateDatabaseTypescript().then((x) => {
  writeFileSync('src/DatabaseExtra.ts', x);
  exit(0);
});

async function generateDatabaseTypescript(database = 'swarmy_test'): Promise<string> {
  const tables = await getRows(`SHOW TABLES FROM ${database}`);
  const tableNames = Types.asArray(tables.map((x) => x[`Tables_in_${database}`])).map((x) => Types.asString(x));
  let out = `import { update, insert, getRows, getOnlyRowOrNull, getOnlyRowOrThrow } from './Database'

type SelectOptions<T> = {
    order?: { column: keyof T, direction: 'ASC' | 'DESC' },
    limit?: number
}

function buildSelect<T>(filter?: Partial<T>, options?: SelectOptions<T>): [string, unknown[]] {
    const where = filter ? ' WHERE ' + Object.keys(filter).map(x => '' + x + ' = ?').join(' AND ') : ''
    const values = filter ? Object.values(filter) : []
    const order = options?.order ? ' ORDER BY ' + (options.order.column as string) + ' ' + options.order.direction : ''
    const limit = options?.limit ? ' LIMIT ' + options.limit : ''
    return [where + order + limit, values]
}

`;
  out += await generateInterfaces(database, tableNames);
  out += await generateGetters(database, tableNames);
  out += await generateUpdaters(database, tableNames);
  out += await generateCreators(database, tableNames);
  return out;
}

async function generateInterfaces(database: string, tableNames: string[]): Promise<string> {
  const interfaceCodeLines: string[] = [];
  const newableCodeLines: string[] = [];
  for (const table of tableNames) {
    const [createTableResult] = await getRows(`SHOW CREATE TABLE ${database}.${table}`);
    const createTableStatement = Types.asString(createTableResult['Create Table']);
    const lines = createTableStatement.split('\n').slice(1, -1);
    const name = Strings.capitalize(table);
    const brandedId = `export type ${name}RowId = number & { __brand: '${name}RowId' };`;
    interfaceCodeLines.push(brandedId);
    interfaceCodeLines.push(`export interface ${name}Row {`);
    newableCodeLines.push(`export interface New${name}Row {`);
    for (const line of lines) {
      if (line.includes('CONSTRAINT "')) {
        continue;
      }
      if (line.includes('KEY "')) {
        continue;
      }
      console.log(line);
      const field = line.trim().split(' ')[0].slice(1, -1);
      const type = line.trim().split(' ')[1];
      const isNotNull = line.includes('NOT NULL');
      const hasDefault = line.includes('DEFAULT');

      const splitName = field.split('_');
      const normalName = Arrays.last(splitName);
      const seenTable = tableNames.find((x) => x.slice(0, -1) === normalName.slice(0, -2));

      let jsType = '';
      if (field === 'id') {
        jsType = `${name}RowId`;
      } else if (field.endsWith('Id') && seenTable) {
        jsType = `${Strings.capitalize(seenTable)}RowId`;
      } else if (type.includes('tinyint')) {
        jsType = '0 | 1';
      } else if (type.includes('int')) {
        jsType = 'number';
      } else if (type.includes('double')) {
        jsType = 'number';
      } else if (type.includes('enum')) {
        const values = Types.asString(Strings.betweenWide(type, '(', ')')).split(',');
        jsType = values.join(' | ');
      } else if (type.includes('varchar')) {
        jsType = 'string';
      } else if (type.includes('text')) {
        jsType = 'string';
      } else if (type.includes('datetime')) {
        jsType = 'Date';
      } else if (type.includes('timestamp')) {
        jsType = 'number';
      } else if (line.includes('PRIMARY KEY')) {
        continue;
      } else if (line.includes('UNIQUE KEY')) {
        continue;
      } else {
        throw Error(`Unknown type: ${type}`);
      }
      interfaceCodeLines.push(`${field}${isNotNull ? '' : '?'}: ${jsType}${isNotNull ? '' : ' | null'}`);
      if (field !== 'id') {
        newableCodeLines.push(
          `${field}${hasDefault || !isNotNull ? '?' : ''}: ${jsType}${hasDefault || !isNotNull ? ' | null' : ''}`,
        );
      }
    }
    interfaceCodeLines.push('}\n');
    newableCodeLines.push('}\n');
  }
  return interfaceCodeLines.join('\n') + '\n\n' + newableCodeLines.join('\n') + '\n\n';
}

async function generateGetters(database: string, tableNames: string[]) {
  let content = '';

  for (const ifName of tableNames) {
    const name = `${Strings.capitalize(ifName)}Row`;
    content += `export async function get${name}s(
            filter?: Partial<${name}>,
            options?: SelectOptions<${name}>
        ): Promise<${name}[]> {
        const [query, values] = buildSelect(filter, options)
        return getRows('SELECT * FROM ${database}.${ifName}' + query, ...values) as unknown as ${name}[]
    }\n\n`;

    content += `export async function getOnly${name}OrNull(
            filter?: Partial<${name}>,
            options?: SelectOptions<${name}>
        ): Promise<${name} | null> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrNull('SELECT * FROM ${database}.${ifName}' + query, ...values) as unknown as ${name} | null
    }\n\n`;

    content += `export async function getOnly${name}OrThrow(
            filter?: Partial<${name}>,
            options?: SelectOptions<${name}>
        ): Promise<${name}> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrThrow('SELECT * FROM ${database}.${ifName}' + query, ...values) as unknown as ${name}
    }\n\n`;
  }

  return content;
}

async function generateUpdaters(database: string, tableNames: string[]) {
  let content = '';

  for (const tableName of tableNames) {
    const name = Strings.capitalize(tableName) + 'Row';
    content += `export async function update${Strings.capitalize(
      tableName,
    )}Row(id: ${name}Id, object: Partial<New${name}>, atomicHelper?: {
    key: keyof New${name}
    value: unknown
}): Promise<number> {
    return update('${database}.${tableName}', id, object, atomicHelper)
    }\n\n`;
  }
  return content;
}

async function generateCreators(database: string, tableNames: string[]) {
  let content = '';

  for (const tableName of tableNames) {
    const name = Strings.capitalize(tableName) + 'Row';
    content += `export async function insert${name}(object: New${name}): Promise<${name}Id> {
        return insert('${database}.${tableName}', object as unknown as Record<string, unknown>) as Promise<${name}Id>
    }\n\n`;
  }
  return content;
}
