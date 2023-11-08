// schema.js
const { GraphQLObjectType, GraphQLList, GraphQLFloat, GraphQLID, GraphQLSchema } = require('graphql');
const { getDriveInfo } = require('./helpers');

const DriveType = new GraphQLObjectType({
  name: 'Drive',
  fields: () => ({
    drive: { type: GraphQLID },
    capacity: { type: GraphQLFloat },
    used: { type: GraphQLFloat },
    free: { type: GraphQLFloat },
  }),
});

const QueryType = new GraphQLObjectType({
  name: 'Query',
  fields: () => ({
    drives: {
      type: new GraphQLList(DriveType),
      resolve: async () => {
        const driveInfo = await getDriveInfo();
        return driveInfo.map(d => ({
          drive: d.device,
          capacity: d.size,
          used: 350000000000,
          free: 150277793000,
        }));

      },
    },
  }),
});

module.exports = new GraphQLSchema({
  query: QueryType,
});

