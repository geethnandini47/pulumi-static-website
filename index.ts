import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

// -----------------------------
// Create S3 bucket (no ACLs)
// -----------------------------
const bucket = new aws.s3.Bucket("static-site-bucket", {
    // No ACLs — AWS best practice, avoids all errors
});

// Upload index.html
const indexFile = new aws.s3.BucketObject("index.html", {
    bucket: bucket.bucket,
    content: "<h1>Hello from Pulumi Static Website!</h1>",
    contentType: "text/html",
});

// -----------------------------
// CloudFront Origin Access Identity
// -----------------------------
const oai = new aws.cloudfront.OriginAccessIdentity("oai", {
    comment: "OAI for static website",
});

// -----------------------------
// Bucket policy allowing CloudFront to read
// -----------------------------
const bucketPolicy = new aws.s3.BucketPolicy("bucket-policy", {
    bucket: bucket.bucket,
    policy: pulumi.all([bucket.bucket, oai.s3CanonicalUserId]).apply(([bucketName, canonicalId]) =>
        JSON.stringify({
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Principal: {
                        CanonicalUser: canonicalId,
                    },
                    Action: ["s3:GetObject"],
                    Resource: [`arn:aws:s3:::${bucketName}/*`],
                },
            ],
        })
    ),
});

// -----------------------------
// CloudFront distribution
// -----------------------------
const cdn = new aws.cloudfront.Distribution("cdn", {
    enabled: true,

    origins: [
        {
            domainName: bucket.bucketRegionalDomainName,
            originId: "s3-origin",
            s3OriginConfig: {
                originAccessIdentity: oai.cloudfrontAccessIdentityPath,
            },
        },
    ],

    defaultRootObject: "index.html",

    defaultCacheBehavior: {
        targetOriginId: "s3-origin",
        viewerProtocolPolicy: "redirect-to-https",
        allowedMethods: ["GET", "HEAD"],
        cachedMethods: ["GET", "HEAD"],
        forwardedValues: {
            cookies: { forward: "none" },
            queryString: false,
        },
    },

    restrictions: {
        geoRestriction: {
            restrictionType: "none",
        },
    },

    viewerCertificate: {
        cloudfrontDefaultCertificate: true,
    },
});

// -----------------------------
// Outputs
// -----------------------------
export const bucketName = bucket.bucket;
export const cloudfrontUrl = cdn.domainName;

