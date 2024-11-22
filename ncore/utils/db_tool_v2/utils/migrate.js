import Base from '#@base';
import os from 'os';
import fs from 'fs';
import path from 'path';

class Migrate extends Base {
    constructor() {
        super();
    }

    添加方法,迁移数据(源db对象,目标DB对象)可以对mysql/sqlite/postgress多个数据库进行混转,原理是读取数据库表,并根据读取的表在另一个数据库对象中建资产负债表,并逐个表读取数据迁移过去