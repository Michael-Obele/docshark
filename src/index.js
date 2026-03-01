#!/usr/bin/env node

import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import * as v from 'valibot';
import { serve } from 'srvx';
import { StdioTransport } from '@tmcp/transport-stdio';
import { HttpTransport } from '@tmcp/transport-http';
import { SseTransport } from '@tmcp/transport-sse';

const server = new McpServer(
	{
		name: 'example-server',
		version: '1.0.0',
		description: 'An example TMCP server',
	},
	{
		adapter: new ValibotJsonSchemaAdapter(),
		capabilities: {
			tools: { listChanged: true },
		},
	}
);

const ExampleSchema = v.object({
	name: v.pipe(v.string(), v.description('Name of the person')),
	age: v.pipe(v.number(), v.description('Age of the person')),
});

server.tool(
	{
		name: 'greet_person',
		description: 'Greet a person by name and age',
		schema: ExampleSchema,
	},
	async (input) => {
		return {
			content: [
				{
					type: 'text',
					text: `Hello ${input.name}! You are ${input.age} years old.`,
				},
			],
		};
	}
);


export const http_transport = new HttpTransport(server);
export const sse_transport = new SseTransport(server);

serve({
	async fetch(request) {
		const http_response = await http_transport.respond(request);
		if (http_response) {
			return http_response;
		}

		const sse_response = await sse_transport.respond(request);
		if (sse_response) {
			return sse_response;
		}
		return new Response(null, { status: 404 });
	}
});


const stdio_transport = new StdioTransport(server);
stdio_transport.listen();