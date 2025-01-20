const { DataTypes } = require('#@/ncore/utils/db_tool/sequelize_db.js');

const sequelize_init_tables = {
    coin_digital: {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: true,
        },
        coin_name: {
            type: DataTypes.TEXT,
        },
        full_name: {
            type: DataTypes.TEXT,
        },
        description: {
            type: DataTypes.TEXT,
        },
        profit: {
            type: DataTypes.STRING,
        },
        read_time: {
            type: DataTypes.STRING,
        },
        time: {
            type: DataTypes.STRING,
        },
        is_delete: {
            type: DataTypes.INTEGER,
        },
        read: {
            type: DataTypes.STRING,
        },
    },

    coin_market_reversal_information: {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: true,
        },
        reverse_point: {
            type: DataTypes.STRING,
        },
        reverse_type: {
            type: DataTypes.INTEGER,
        },
        coin_name_id: {
            type: DataTypes.TEXT,
        },
        read_time: {
            type: DataTypes.STRING,
        },
        time: {
            type: DataTypes.STRING,
        },
        is_delete: {
            type: DataTypes.INTEGER,
        },
        read: {
            type: DataTypes.STRING,
        },
    },

    coin_real_time_point: {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: true,
        },
        real_time: {
            type: DataTypes.INTEGER,
        },
        data1: {
            type: DataTypes.STRING,
        },
        data2: {
            type: DataTypes.STRING,
        },
        real_price: {
            type: DataTypes.STRING,
        },
        real_price2: {
            type: DataTypes.STRING,
        },
        data_: {
            type: DataTypes.STRING,
        },
        data__: {
            type: DataTypes.STRING,
        },
        coin_name_id: {
            type: DataTypes.INTEGER,
        },
        read_time: {
            type: DataTypes.STRING,
        },
        time: {
            type: DataTypes.STRING,
        },
        is_delete: {
            type: DataTypes.INTEGER,
        },
        read: {
            type: DataTypes.STRING,
        },
    },

    sundries_default_table: {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: true,
        },
        text: {
            type: DataTypes.TEXT,
        },
        origin_type: {
            type: DataTypes.TEXT,
        },
        read: {
            type: DataTypes.STRING,
        },
        time: {
            type: DataTypes.STRING,
        },
        is_delete: {
            type: DataTypes.INTEGER,
        },
    },

    translation_dictionary: {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: true,
            autoIncrement: true 
        },
        word: {
            type: DataTypes.CHAR(100),
            unique: true,
        },
        language: {
            type: DataTypes.TEXT,
        },
        translate_bing: {
            type: DataTypes.TEXT,
        },
        last_time: {
            type: DataTypes.STRING,
        },
        read: {
            type: DataTypes.INTEGER,
        },
        time: {
            type: DataTypes.STRING,
        },
        read_time: {
            type: DataTypes.STRING,
        },
        word_sort: {
            type: DataTypes.STRING(100),
        },
        phonetic_us: {
            type: DataTypes.STRING(50),
        },
        phonetic_us_sort: {
            type: DataTypes.STRING(50),
        },
        phonetic_uk: {
            type: DataTypes.STRING(50),
        },
        phonetic_uk_sort: {
            type: DataTypes.STRING(50),
        },
        is_delete: {
            type: DataTypes.INTEGER,
        },
        phonetic_uk_length: {
            type: DataTypes.INTEGER,
        },
        phonetic_us_length: {
            type: DataTypes.INTEGER,
        },
        word_length: {
            type: DataTypes.INTEGER,
        },
    },

    translation_notebook: {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: true,
            autoIncrement: true 
        },
        group_id: {
            type: DataTypes.INTEGER,
        },
        user_id: {
            type: DataTypes.INTEGER,
        },
        word_id: {
            type: DataTypes.INTEGER,
        },
        reference_url: {
            type: DataTypes.TEXT,
        },
        last_time: {
            type: DataTypes.STRING,
        },
        read: {
            type: DataTypes.INTEGER,
        },
        time: {
            type: DataTypes.STRING,
        },
        is_delete: {
            type: DataTypes.INTEGER,
        },
    },

    translation_voices: {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: true,
            autoIncrement: true 
        },
        group_id: {
            type: DataTypes.STRING,
        },
        sentence: {
            type: DataTypes.TEXT,
        },
        voice: {
            type: DataTypes.TEXT,
        },
        link_words: {
            type: DataTypes.TEXT,
        },
        last_time: {
            type: DataTypes.STRING,
        },
        read: {
            type: DataTypes.INTEGER,
        },
        time: {
            type: DataTypes.STRING,
        },
        is_delete: {
            type: DataTypes.INTEGER,
        },
        md5: {
            type: DataTypes.CHAR(32),
            unique: true,
        },
    },

    user_gtu_map: {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: true,
        },
        userid: {
            type: DataTypes.INTEGER,
            unique: true,
        },
        group_map: {
            type: DataTypes.TEXT,
        },
        ids_map: {
            type: DataTypes.TEXT,
        },
        sort_map: {
            type: DataTypes.TEXT,
        },
        is_delete: {
            type: DataTypes.INTEGER,
            defaultValue: "0",
        },
        time: {
            type: DataTypes.STRING,
        },
        read: {
            type: DataTypes.STRING,
            defaultValue: "0",
        },
    },

    user_dtu_map: {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: true,
        },
        userid: {
            type: DataTypes.INTEGER,
        },
        wordid: {
            type: DataTypes.INTEGER,
        },
        read_time: {
            type: DataTypes.STRING,
        },
        md5: {
            type: DataTypes.STRING(32),
            allowNull: true,
            unique: true,
        },
        is_delete: {
            type: DataTypes.INTEGER,
            defaultValue: "0",
        },
        time: {
            type: DataTypes.STRING,
        },
        read: {
            type: DataTypes.STRING,
            defaultValue: "0",
        },
        read_weiht: {
            type: DataTypes.STRING,
        },
        read_weight: {
            type: DataTypes.STRING,
        },
    },

    user_dtu_ids: {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: true,
        },
        sort_type: {
            type: DataTypes.INTEGER,
            unique: true,
        },
        sort_map: {
            type: DataTypes.TEXT,
        },
        is_delete: {
            type: DataTypes.INTEGER,
            defaultValue: "0",
        },
        time: {
            type: DataTypes.STRING,
        },
        read: {
            type: DataTypes.STRING,
            defaultValue: "0",
        },
    },

    user: {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: true,
        },
        user: {
            type: DataTypes.STRING(100),
            unique: true,
        },
        pwd: {
            type: DataTypes.STRING(32),
        },
        role: {
            type: DataTypes.INTEGER,
        },
        trans_count: {
            type: DataTypes.INTEGER,
        },
        last_login: {
            type: DataTypes.TEXT,
        },
        last_time: {
            type: DataTypes.STRING,
        },
        register_time: {
            type: DataTypes.STRING,
        },
        register_ip: {
            type: DataTypes.STRING(32),
        },
        read: {
            type: DataTypes.INTEGER,
        },
        is_delete: {
            type: DataTypes.INTEGER,
            defaultValue: "0",
        },
        time: {
            type: DataTypes.STRING,
        },
    },

};

module.exports = {
    sequelize_init_tables
};