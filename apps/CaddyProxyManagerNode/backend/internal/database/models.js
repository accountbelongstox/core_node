const { Model, DataTypes } = require('sequelize');
    const { sequelize } = require('./sqlite.js');

    class Host extends Model {}
    class Upstream extends Model {}
    class User extends Model {}

    Host.init({
        domains: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isValidDomain: (value) => {
                    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
                    if (!domainRegex.test(value)) {
                        throw new Error('Invalid domain format');
                    }
                }
            }
        },
        matcher: {
            type: DataTypes.STRING
        }
    }, {
        sequelize,
        modelName: 'Host'
    });

    Upstream.init({
        hostId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        backend: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isValidBackend: (value) => {
                    const backendRegex = /^[a-zA-Z0-9-_.]+:\d+$/;
                    if (!backendRegex.test(value)) {
                        throw new Error('Invalid backend format');
                    }
                }
            }
        }
    }, {
        sequelize,
        modelName: 'Upstream'
    });

    User.init({
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true
            }
        },
        secret: {
            type: DataTypes.STRING
        }
    }, {
        sequelize,
        modelName: 'User'
    });

    // Define relationships
    Host.hasMany(Upstream, { foreignKey: 'hostId' });
    Upstream.belongsTo(Host, { foreignKey: 'hostId' });

    module.exports = { Host, Upstream, User };