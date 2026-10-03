from rest_framework import serializers

from .models import Sale


class SaleSerializer(serializers.ModelSerializer):
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Sale
        fields = ["id", "student", "quantity", "unit_price", "total", "created_at"]
        read_only_fields = ["id", "created_at"]
