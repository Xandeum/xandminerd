// schema.js
const { GraphQLObjectType, GraphQLList, GraphQLFloat, GraphQLID, GraphQLSchema, GraphQLString } = require('graphql');
const { getDriveInfo } = require('./helpers');

const DriveType = new GraphQLObjectType({
  name: 'Drive',
  fields: () => ({
    id: { type: GraphQLID },
    name: { type: GraphQLString },
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
          id: d.id,
          name: d.identifier,
          capacity: d.capacity,
          used: d.fsUsed,
          free: d.fsAvailable,
        }));

      },
    },
  }),
});

module.exports = new GraphQLSchema({
  query: QueryType,
});
