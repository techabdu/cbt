<?php

namespace App\Http\Requests\ExamOfficer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PromoteToDepartmentOfficerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $schoolId = $this->attributes->get('school_id');

        return [
            'department_id' => ['required', 'integer',
                Rule::exists('departments', 'id')->where('school_id', $schoolId)],
            'reason'        => ['nullable', 'string', 'max:500'],
        ];
    }
}
