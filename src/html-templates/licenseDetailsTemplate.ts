export const licenseDetailsTemplate = (
	licenseName: string,
	dependencies: any[],
	dependencyRows: string
): string => `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<title>License Details</title>
	<style>
		body { font-family: Arial, sans-serif; padding: 20px; }
		table { border-collapse: collapse; width: 100%; }
		th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
		th { background-color: #f2f2f2; }
		h1 { color: #333; }
	</style>
</head>
<body>
	<h1>License: ${licenseName}</h1>
	<p><strong>Dependencies using this license:</strong> ${dependencies.length}</p>
	
	<table>
		<thead>
			<tr>
				<th>Package Name</th>
				<th>Version</th>
				<th>Repository</th>
				<th>Homepage</th>
			</tr>
		</thead>
		<tbody>
			${dependencyRows}
		</tbody>
	</table>
</body>
</html>
`;
